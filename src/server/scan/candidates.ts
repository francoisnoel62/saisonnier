import "server-only"

import { createHash } from "node:crypto"
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm"

import type { AdmissionDecision } from "@/domain/scan/admission"
import { compareRecruitment } from "@/domain/scan/identity"
import { scanLimits } from "@/domain/scan/limits"
import {
  boundEvidence,
  boundObservations,
  boundText,
  observationLimits,
  type ExtractedPosting,
} from "@/domain/scan/observation"
import type { ScanProposal } from "@/domain/scan/proposal"
import { dateInZone } from "@/domain/scan/source-date"
import {
  scanIssue,
  uniqueIssues,
  type ExclusionReason,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanRuns,
  scanRunSources,
  type ScanCandidate,
} from "@/lib/db/schema"

import { withRunClaim, type ScanTransaction } from "./claim"
import { recordCandidateDivergences } from "./divergences"
import { attachOccupationInTransaction } from "./occupations"

// Version de la source figée par le passage (initRunSources) ; nulle hors d'un passage initialisé.
function frozenRevision(runId: string, sourceKey: string) {
  return sql<
    number | null
  >`(select source_revision from scan_run_sources where run_id = ${runId} and source_key = ${sourceKey})`
}

export type ListedPosting = {
  identityKey: string
  discoveryUrl: string
  externalId?: string
  listingHash: string
  now?: Date
}

export function recordListedPosting(
  runId: string,
  token: string,
  sourceKey: string,
  listed: ListedPosting,
) {
  return withRunClaim(runId, token, async (tx) => {
    const now = listed.now ?? new Date()
    const [inserted] = await tx
      .insert(scanCandidates)
      .values({
        sourceKey,
        sourceRevision: frozenRevision(runId, sourceKey),
        identityKey: listed.identityKey,
        discoveryUrl: listed.discoveryUrl,
        externalId: listed.externalId,
        listingHash: listed.listingHash,
        firstRunId: runId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoNothing()
      .returning()
    if (inserted) return { ok: true, kind: "new", candidate: inserted } as const
    const [known] = await tx
      .select()
      .from(scanCandidates)
      .where(
        and(
          eq(scanCandidates.sourceKey, sourceKey),
          eq(scanCandidates.identityKey, listed.identityKey),
        ),
      )
      .orderBy(desc(scanCandidates.generation))
      .limit(1)
      .for("update")
    const changed = known.listingHash !== listed.listingHash
    const excluded =
      known.status === "excluded" ||
      (known.status === "failed" && known.attempts >= scanLimits.maxAttempts)
    // Une décision humaine n'est jamais modifiée par la redécouverte.
    const [candidate] = await tx
      .update(scanCandidates)
      .set({
        lastSeenAt: now,
        ...(excluded && changed
          ? {
              status: "discovered" as const,
              exclusionReason: null,
              exclusionDetail: null,
              attempts: 0,
              lastError: null,
              listingHash: listed.listingHash,
            }
          : {}),
      })
      .where(eq(scanCandidates.id, known.id))
      .returning()
    return {
      ok: true,
      kind: changed
        ? "listing_changed"
        : excluded
          ? "skip_excluded"
          : "rediscovered",
      candidate,
    } as const
  })
}

export async function nextPistesToProcess(
  runId: string,
  sourceKey: string,
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > scanLimits.maxPostings)
    throw new RangeError("Taille de lot invalide")
  return db
    .select({ candidate: scanCandidates })
    .from(scanCandidates)
    .innerJoin(scanRuns, eq(scanRuns.id, runId))
    .where(
      and(
        eq(scanCandidates.sourceKey, sourceKey),
        inArray(scanCandidates.status, ["discovered", "failed"]),
        lt(scanCandidates.attempts, scanLimits.maxAttempts),
        // Reprendre les pistes du passage, y compris celles déjà connues revues dans sa liste.
        or(
          eq(scanCandidates.firstRunId, runId),
          sql`${scanCandidates.lastSeenAt} >= ${scanRuns.startedAt}`,
        ),
      ),
    )
    .orderBy(asc(scanCandidates.firstSeenAt), asc(scanCandidates.id))
    .limit(limit)
    .then((rows) => rows.map((row) => row.candidate))
}

export type CandidateDelivery = {
  candidateId: string
  runId: string
  token: string
  extraction: ExtractedPosting & { extractorVersion?: string }
  admission: Extract<AdmissionDecision, { admitted: true }>
  proposal: ScanProposal
  now: Date
}

async function deliver(tx: ScanTransaction, input: CandidateDelivery) {
  const { extraction, admission, proposal, candidateId, runId, now } = input
  const [current] = await tx
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, candidateId))
    .for("update")
  if (current && ["published", "rejected"].includes(current.status)) {
    await recordCandidateDivergences(tx, current, proposal)
    return { ok: true, delivered: false } as const
  }
  if (!admission.admitted)
    throw new RangeError("Un dossier non admis ne peut pas être livré")
  const title = (
    extraction.title ??
    (proposal.title.status === "established" ? proposal.title.value : "")
  ).trim()
  if (!title) throw new RangeError("Un dossier livré exige un intitulé")
  const sourceDate = extraction.sourceDate
  const truncated =
    Array.from(extraction.usefulText).length > observationLimits.text ||
    extraction.observations.length > observationLimits.observations ||
    extraction.observations.some(
      (o) => Array.from(o.evidence.excerpt).length > observationLimits.excerpt,
    )
  const issues = uniqueIssues([
    ...proposal.issues,
    ...admission.blocking,
    ...admission.alerts,
    ...(truncated ? [scanIssue("text_truncated")] : []),
  ])
  const [candidate] = await tx
    .update(scanCandidates)
    .set({
      status: "to_review",
      readyForReviewAt: now,
      deliveredRunId: runId,
      title,
      officialUrl: extraction.officialUrl ?? null,
      pageText: boundText(extraction.usefulText),
      observations: boundObservations(extraction.observations),
      proposal,
      issues,
      signals: admission.signals.map((signal) => ({
        ...signal,
        evidence: signal.evidence.map(boundEvidence),
      })),
      sourcePublishedDate:
        sourceDate?.precision === "day"
          ? sourceDate.date
          : sourceDate
            ? dateInZone(Date.parse(sourceDate.at), "Europe/Paris")
            : null,
      sourcePublishedAt:
        sourceDate?.precision === "instant" ? new Date(sourceDate.at) : null,
      contentHash: createHash("sha256")
        .update(extraction.usefulText)
        .digest("hex"),
      extractorVersion:
        extraction.extractorVersion ??
        extraction.observations[0]?.extractorVersion ??
        "unknown",
      lastFetchedAt: now,
      lastError: null,
    })
    .where(
      and(
        eq(scanCandidates.id, candidateId),
        inArray(scanCandidates.status, ["discovered", "failed"]),
      ),
    )
    .returning()
  if (!candidate) return { ok: true, delivered: false } as const
  const attached = await attachOccupationInTransaction(tx, candidate)
  // Le passage est déjà verrouillé : un seul incrément et une seule date de seuil, même avec 60 livraisons simultanées.
  await tx
    .update(scanRuns)
    .set({
      deliveredCount: sql`${scanRuns.deliveredCount} + 1`,
      firstDeliveredAt: sql`coalesce(${scanRuns.firstDeliveredAt}, ${now})`,
      targetReachedAt: sql`case when ${scanRuns.targetReachedAt} is null and ${scanRuns.deliveredCount} + 1 >= ${scanRuns.targetCount} then ${now} else ${scanRuns.targetReachedAt} end`,
      lastProgressAt: now,
    })
    .where(eq(scanRuns.id, runId))
  const [source] = await tx
    .update(scanRunSources)
    .set({ deliveredCount: sql`${scanRunSources.deliveredCount} + 1` })
    .where(
      and(
        eq(scanRunSources.runId, runId),
        eq(scanRunSources.sourceKey, candidate.sourceKey),
      ),
    )
    .returning()
  if (!source) throw new Error("Source du passage non initialisée")
  return { ok: true, delivered: true, candidate: attached } as const
}

export function deliverCandidate(input: CandidateDelivery) {
  return withRunClaim(input.runId, input.token, (tx) => deliver(tx, input))
}

export function excludeCandidate({
  candidateId,
  runId,
  token,
  reason,
  detail,
  now,
}: {
  candidateId: string
  runId: string
  token: string
  reason: ExclusionReason
  detail?: string
  now: Date
}) {
  return withRunClaim(runId, token, async (tx) => {
    const [candidate] = await tx
      .update(scanCandidates)
      .set({
        status: "excluded",
        exclusionReason: reason,
        exclusionDetail: detail ? boundText(detail) : null,
        lastFetchedAt: now,
      })
      .where(
        and(
          eq(scanCandidates.id, candidateId),
          inArray(scanCandidates.status, ["discovered", "failed"]),
        ),
      )
      .returning()
    if (candidate)
      await tx
        .update(scanRunSources)
        .set({ excludedCount: sql`${scanRunSources.excludedCount} + 1` })
        .where(
          and(
            eq(scanRunSources.runId, runId),
            eq(scanRunSources.sourceKey, candidate.sourceKey),
          ),
        )
    return { ok: true, excluded: !!candidate } as const
  })
}

// expectedAttempts est lu avant l'essai : rejouer son résultat n'incrémente pas une seconde fois.
export function recordFailure(
  candidateId: string,
  error: string,
  context: {
    runId: string
    token: string
    expectedAttempts: number
    now: Date
  },
) {
  return withRunClaim(context.runId, context.token, async (tx) => {
    const [candidate] = await tx
      .update(scanCandidates)
      .set({
        status:
          context.expectedAttempts + 1 >= scanLimits.maxAttempts
            ? "failed"
            : "discovered",
        attempts: sql`${scanCandidates.attempts} + 1`,
        lastError: boundText(error),
        lastFetchedAt: context.now,
      })
      .where(
        and(
          eq(scanCandidates.id, candidateId),
          inArray(scanCandidates.status, ["discovered", "failed"]),
          eq(scanCandidates.attempts, context.expectedAttempts),
          lt(scanCandidates.attempts, scanLimits.maxAttempts),
        ),
      )
      .returning()
    if (candidate)
      await tx
        .update(scanRunSources)
        .set({ failedCount: sql`${scanRunSources.failedCount} + 1` })
        .where(
          and(
            eq(scanRunSources.runId, context.runId),
            eq(scanRunSources.sourceKey, candidate.sourceKey),
          ),
        )
    return { ok: true, recorded: !!candidate } as const
  })
}

// Une génération est créée et livrée dans la même transaction. La dernière génération
// sert de comparaison : le rejeu d'une extraction de la même période ne recrée rien.
export function newGeneration(
  candidateId: string,
  input: Omit<CandidateDelivery, "candidateId"> & { listingHash: string },
) {
  return withRunClaim(input.runId, input.token, async (tx) => {
    const [original] = await tx
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, candidateId))
    if (!original) return { ok: false, reason: "candidate_not_found" } as const
    const [latest] = await tx
      .select()
      .from(scanCandidates)
      .where(
        and(
          eq(scanCandidates.sourceKey, original.sourceKey),
          eq(scanCandidates.identityKey, original.identityKey),
        ),
      )
      .orderBy(desc(scanCandidates.generation))
      .limit(1)
      .for("update")
    if (
      !latest.proposal ||
      !latest.title ||
      compareRecruitment(
        { title: latest.title, period: latest.proposal.period },
        { title: input.extraction.title ?? "", period: input.proposal.period },
      ) !== "other_period"
    )
      return { ok: false, reason: "not_other_period" } as const
    const [candidate] = await tx
      .insert(scanCandidates)
      .values({
        sourceKey: latest.sourceKey,
        sourceRevision: frozenRevision(input.runId, latest.sourceKey),
        identityKey: latest.identityKey,
        generation: latest.generation + 1,
        discoveryUrl: input.extraction.discoveryUrl,
        externalId: input.extraction.externalId ?? latest.externalId,
        firstRunId: input.runId,
        firstSeenAt: input.now,
        lastSeenAt: input.now,
        listingHash: input.listingHash,
      })
      .returning()
    return deliver(tx, {
      ...input,
      candidateId: candidate.id,
      proposal: {
        ...input.proposal,
        issues: uniqueIssues([
          ...input.proposal.issues,
          scanIssue("reused_identity"),
        ]),
      },
    })
  })
}

export type { ScanCandidate }
