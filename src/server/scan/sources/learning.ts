import "server-only"

import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm"
import { z } from "zod"

import { valueOf } from "@/domain/scan/field"
import {
  employerLeadKey,
  type EmployerLeadDetails,
} from "@/domain/scan/employer-lead"
import {
  placeAliasSchema,
  type ScanSourceDraftSnapshot,
} from "@/domain/scan/source"
import {
  discoveryCoverage,
  type CoverageDossier,
} from "@/domain/scan/source-health"
import {
  employerLeadDecisions,
  type EmployerLeadDecision,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  departments,
  offers,
  scanCandidates,
  scanReviews,
  scanSourceHosts,
  scanSources,
  type ScanCandidate,
} from "@/lib/db/schema"
import { isUuid } from "@/server/offers/queries"

import { loadScanSource } from "./registry"
import { recordSourceEvent, reviseSnapshot } from "./writes"

// Boucles d'apprentissage depuis la revue (lot F) : un lieu mémorisé ne se redemande plus ; un
// employeur révélé par une découverte devient une source, ou une piste « à inviter ».
type LearningResult =
  | { ok: true; key?: string; reviewId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

async function loadCandidate(candidateId: string) {
  if (!isUuid(candidateId)) return null
  const [candidate] = await db
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, candidateId))
  return candidate ?? null
}

const aliasInputSchema = z.object({
  name: z.string().trim().min(1, "Nom lu sur la source attendu.").max(200),
  communeName: z.string().trim().min(1, "Commune attendue.").max(200),
  inseeCode: z.string().trim(),
  departmentCode: z.string().trim(),
})

// « Mémoriser ce lieu » : l'alias (nom de la source → commune vérifiée) rejoint la
// configuration par une version non sensible ; le passage suivant établit ce lieu sans revue.
export async function learnPlaceAlias(
  candidateId: string,
  input: z.input<typeof aliasInputSchema>,
  adminId: string,
): Promise<LearningResult> {
  const parsed = aliasInputSchema.safeParse(input)
  const alias = parsed.success
    ? placeAliasSchema.safeParse({
        inseeCode: parsed.data.inseeCode,
        name: parsed.data.communeName,
        departmentCode: parsed.data.departmentCode,
      })
    : null
  if (
    !parsed.success ||
    !alias?.success ||
    !alias.data.inseeCode.startsWith(alias.data.departmentCode)
  )
    return {
      ok: false,
      message:
        "Commune vérifiée attendue : nom, département et code INSEE préfixé par le département.",
    }
  const [department] = await db
    .select({ code: departments.code })
    .from(departments)
    .where(eq(departments.code, alias.data.departmentCode))
  if (!department)
    return { ok: false, message: "Département inconnu du référentiel." }
  const candidate = await loadCandidate(candidateId)
  if (!candidate) return { ok: false, message: "Dossier inconnu." }
  const source = await loadScanSource(candidate.sourceKey)
  if (!source || source.row.status === "archived")
    return { ok: false, message: "Source archivée : restaurez-la d'abord." }
  const definition = source.revision.definition as ScanSourceDraftSnapshot
  const result = await reviseSnapshot(
    source.row.key,
    source.row.version,
    {
      ...definition,
      placeAliases: {
        ...(definition.placeAliases ?? {}),
        [parsed.data.name]: alias.data,
      },
    },
    adminId,
    {
      note: `Lieu mémorisé depuis le dossier « ${(candidate.title ?? candidate.id).slice(0, 150)} ».`,
    },
  )
  if (!result.ok) return { ok: false, message: result.message }
  await db.transaction((tx) =>
    recordSourceEvent(
      tx,
      source.row.key,
      {
        kind: "alias_learned",
        details: {
          name: parsed.data.name,
          communeName: alias.data.name,
          inseeCode: alias.data.inseeCode,
          candidateId,
        },
      },
      { actorUserId: adminId, revision: result.revision },
    ),
  )
  return { ok: true, key: source.row.key }
}

function candidateEmployer(candidate: ScanCandidate) {
  const company = candidate.proposal
    ? valueOf(candidate.proposal.company)
    : undefined
  return company?.name?.trim()
    ? { name: company.name.trim(), siren: company.siren ?? null }
    : null
}

// « Cet employeur n'a pas de portail carrière » : ouvre ou réutilise la piste de l'employeur.
// Une piste n'est jamais recréée ; ses occurrences comptent les dossiers.
export async function markEmployerWithoutPortal(
  candidateId: string,
  adminId: string,
): Promise<LearningResult> {
  const candidate = await loadCandidate(candidateId)
  if (!candidate) return { ok: false, message: "Dossier inconnu." }
  const [source] = await db
    .select({ kind: scanSources.kind })
    .from(scanSources)
    .where(eq(scanSources.key, candidate.sourceKey))
  if (source?.kind !== "discovery")
    return {
      ok: false,
      message: "Seul un dossier de découverte révèle un employeur à inviter.",
    }
  const employer = candidateEmployer(candidate)
  const groupKey = employer ? employerLeadKey(employer) : null
  if (!employer || !groupKey)
    return { ok: false, message: "Identifiez d'abord l'employeur du dossier." }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('scan-employer-lead'), hashtext(${groupKey}))`,
    )
    const [existing] = await tx
      .select()
      .from(scanReviews)
      .where(
        and(
          eq(scanReviews.kind, "employer_lead"),
          eq(scanReviews.groupKey, groupKey),
        ),
      )
      .for("update")
    const proposalLocation = candidate.proposal
      ? valueOf(candidate.proposal.locations)?.[0]?.communeName
      : undefined
    if (existing) {
      const details = existing.details as EmployerLeadDetails
      if (details.candidateIds.includes(candidate.id))
        return { ok: true, reviewId: existing.id }
      await tx
        .update(scanReviews)
        .set({
          occurrences: existing.occurrences + 1,
          lastSeenAt: new Date(),
          details: {
            ...details,
            candidateIds: [...details.candidateIds, candidate.id].slice(-50),
            lastSeenTitle: candidate.title,
          },
        })
        .where(eq(scanReviews.id, existing.id))
      return { ok: true, reviewId: existing.id }
    }
    const details: EmployerLeadDetails = {
      name: employer.name,
      siren: employer.siren,
      communeName: proposalLocation ?? null,
      sourceKey: candidate.sourceKey,
      candidateIds: [candidate.id],
      lastSeenTitle: candidate.title,
    }
    const [review] = await tx
      .insert(scanReviews)
      .values({
        kind: "employer_lead",
        groupKey,
        candidateId: candidate.id,
        sourceKey: candidate.sourceKey,
        details,
      })
      .returning({ id: scanReviews.id })
    console.info("[scan source] employer_lead", { groupKey, adminId })
    return { ok: true, reviewId: review.id }
  })
}

const decisionSchema = z
  .object({
    decision: z.enum(employerLeadDecisions),
    note: z.string().trim().max(2000),
  })
  .refine(
    (value) => value.decision === "has_portal" || value.note.length >= 3,
    {
      path: ["note"],
      message: "Note obligatoire : date et canal du contact, ou motif.",
    },
  )

// Décisions datées et attribuées. L'invitation est faite à la main par le fondateur, depuis sa
// boîte : aucun email n'est envoyé à un employeur.
export async function decideEmployerLead(
  reviewId: string,
  input: { decision: EmployerLeadDecision; note: string },
  adminId: string,
): Promise<LearningResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      message: "Note obligatoire pour une invitation ou un écart.",
      fieldErrors: { note: ["Note obligatoire."] },
    }
  if (!isUuid(reviewId)) return { ok: false, message: "Piste inconnue." }
  const [updated] = await db
    .update(scanReviews)
    .set({
      status: parsed.data.decision === "dismissed" ? "dismissed" : "resolved",
      decision: {
        decision: parsed.data.decision,
        note: parsed.data.note || null,
      },
      decidedAt: new Date(),
      decidedByUserId: adminId,
    })
    .where(
      and(eq(scanReviews.id, reviewId), eq(scanReviews.kind, "employer_lead")),
    )
    .returning({ id: scanReviews.id })
  return updated
    ? { ok: true, reviewId }
    : { ok: false, message: "Piste inconnue." }
}

// Pistes à traiter ou invitées, par nombre de dossiers puis date.
export async function listEmployerLeads() {
  const rows = await db
    .select({
      review: scanReviews,
      sourceLabel: scanSources.label,
    })
    .from(scanReviews)
    .leftJoin(scanSources, eq(scanSources.key, scanReviews.sourceKey))
    .where(
      and(
        eq(scanReviews.kind, "employer_lead"),
        or(
          eq(scanReviews.status, "open"),
          sql`${scanReviews.decision}->>'decision' = 'invited'`,
        ),
      ),
    )
    .orderBy(desc(scanReviews.occurrences), desc(scanReviews.lastSeenAt))
  return rows.map(({ review, sourceLabel }) => ({
    id: review.id,
    status: review.status,
    decision:
      (review.decision as { decision?: string; note?: string } | null) ?? null,
    occurrences: review.occurrences,
    lastSeenAt: review.lastSeenAt.toISOString(),
    sourceLabel,
    details: review.details as EmployerLeadDetails,
  }))
}

// Dossiers d'une découverte, pour la couverture et les propositions de pistes.
async function discoveryDossiers(sourceKeys: string[]) {
  if (!sourceKeys.length) return []
  const rows = await db
    .select({
      candidate: scanCandidates,
      offerSourceUrl: offers.sourceUrl,
      offerCompanyId: offers.companyId,
    })
    .from(scanCandidates)
    .leftJoin(offers, eq(offers.id, scanCandidates.offerId))
    .where(
      and(
        inArray(scanCandidates.sourceKey, sourceKeys),
        isNotNull(scanCandidates.readyForReviewAt),
      ),
    )
  return rows.map(({ candidate, offerSourceUrl, offerCompanyId }) => {
    const employer = candidateEmployer(candidate)
    const official =
      offerSourceUrl ??
      candidate.officialUrl ??
      (candidate.proposal ? valueOf(candidate.proposal.officialUrl) : undefined)
    let officialHost: string | null = null
    try {
      officialHost = official ? new URL(official).hostname : null
    } catch {
      officialHost = null
    }
    return {
      candidate,
      employer,
      dossier: {
        at: candidate.decidedAt ?? candidate.readyForReviewAt!,
        employerKey: employer ? employerLeadKey(employer) : null,
        officialHost,
        companyId: offerCompanyId,
      } satisfies CoverageDossier,
    }
  })
}

async function coverageContext(today: Date) {
  const [hosts, sources, leads] = await Promise.all([
    db
      .select({ host: scanSourceHosts.host })
      .from(scanSourceHosts)
      .innerJoin(scanSources, eq(scanSources.key, scanSourceHosts.sourceKey))
      .where(eq(scanSources.kind, "employer")),
    db
      .select({ companyId: scanSources.companyId })
      .from(scanSources)
      .where(
        and(
          eq(scanSources.kind, "employer"),
          ne(scanSources.status, "archived"),
          isNotNull(scanSources.companyId),
        ),
      ),
    db
      .select({ groupKey: scanReviews.groupKey })
      .from(scanReviews)
      .where(
        and(
          eq(scanReviews.kind, "employer_lead"),
          or(
            eq(scanReviews.status, "open"),
            sql`${scanReviews.decision}->>'decision' = 'invited'`,
          ),
        ),
      ),
  ])
  return {
    coveredHosts: new Set(hosts.map((row) => row.host)),
    coveredCompanyIds: new Set(
      sources.map((row) => row.companyId).filter((id): id is string => !!id),
    ),
    leadKeys: new Set(leads.map((row) => row.groupKey)),
    today,
  }
}

export async function sourceCoverage(sourceKey: string, today = new Date()) {
  const [dossiers, context] = await Promise.all([
    discoveryDossiers([sourceKey]),
    coverageContext(today),
  ])
  return discoveryCoverage(
    dossiers.map((item) => item.dossier),
    context,
  )
}

// Compteurs de la liste des sources et propositions de pistes (deux dossiers au moins, sans
// source ni piste) : rien n'est créé sans l'admin.
export async function discoveryRadar(today = new Date()) {
  const discoveries = await db
    .select({ key: scanSources.key })
    .from(scanSources)
    .where(eq(scanSources.kind, "discovery"))
  const [dossiers, context, allLeads] = await Promise.all([
    discoveryDossiers(discoveries.map((row) => row.key)),
    coverageContext(today),
    db
      .select({ groupKey: scanReviews.groupKey })
      .from(scanReviews)
      .where(eq(scanReviews.kind, "employer_lead")),
  ])
  const leadKeys = new Set(allLeads.map((row) => row.groupKey))
  const portals = new Set(
    dossiers
      .map((item) => item.dossier.officialHost)
      .filter(
        (host): host is string => !!host && !context.coveredHosts.has(host),
      ),
  )
  // Hôtes des découvertes elles-mêmes : jamais un portail employeur.
  const discoveryHosts = new Set(
    (
      await db
        .select({ host: scanSourceHosts.host })
        .from(scanSourceHosts)
        .innerJoin(scanSources, eq(scanSources.key, scanSourceHosts.sourceKey))
        .where(eq(scanSources.kind, "discovery"))
    ).map((row) => row.host),
  )
  for (const host of discoveryHosts) portals.delete(host)
  const groups = new Map<
    string,
    { name: string; siren: string | null; candidateIds: string[] }
  >()
  for (const { candidate, employer, dossier } of dossiers) {
    if (
      !employer ||
      !dossier.employerKey ||
      leadKeys.has(dossier.employerKey) ||
      (dossier.officialHost &&
        context.coveredHosts.has(dossier.officialHost)) ||
      (dossier.companyId && context.coveredCompanyIds.has(dossier.companyId))
    )
      continue
    const group = groups.get(dossier.employerKey) ?? {
      name: employer.name,
      siren: employer.siren,
      candidateIds: [],
    }
    group.candidateIds.push(candidate.id)
    groups.set(dossier.employerKey, group)
  }
  const [{ toInvite }] = await db
    .select({ toInvite: sql<number>`count(*)::int` })
    .from(scanReviews)
    .where(
      and(
        eq(scanReviews.kind, "employer_lead"),
        eq(scanReviews.status, "open"),
      ),
    )
  return {
    portalsWithoutSource: portals.size,
    employersToInvite: toInvite,
    proposals: [...groups.entries()]
      .filter(([, group]) => group.candidateIds.length >= 2)
      .map(([key, group]) => ({ key, ...group }))
      .sort((a, b) => b.candidateIds.length - a.candidateIds.length),
  }
}

// Portail employeur d'un dossier de découverte encore couvert par aucune source.
export async function uncoveredEmployerPortal(candidate: ScanCandidate) {
  const [source] = await db
    .select({ kind: scanSources.kind })
    .from(scanSources)
    .where(eq(scanSources.key, candidate.sourceKey))
  if (source?.kind !== "discovery") return null
  const [offer] = candidate.offerId
    ? await db
        .select({ sourceUrl: offers.sourceUrl })
        .from(offers)
        .where(eq(offers.id, candidate.offerId))
    : []
  const official =
    offer?.sourceUrl ??
    candidate.officialUrl ??
    (candidate.proposal ? valueOf(candidate.proposal.officialUrl) : undefined)
  if (!official || !URL.canParse(official)) return null
  const host = new URL(official).hostname
  const [owner] = await db
    .select({ key: scanSourceHosts.sourceKey })
    .from(scanSourceHosts)
    .where(eq(scanSourceHosts.host, host))
  return owner ? null : { url: official, host }
}
