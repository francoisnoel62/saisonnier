import "server-only"

import { setTimeout as delay } from "node:timers/promises"

import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm"

import { todayInParis } from "@/domain/offer-activity"
import { admitPosting } from "@/domain/scan/admission"
import {
  scanFailureLabels,
  stopsSource,
  type ScanFailureReason,
} from "@/domain/scan/http"
import { scanLimits } from "@/domain/scan/limits"
import type { ExtractedPosting } from "@/domain/scan/observation"
import { canStartPosting, planDomains } from "@/domain/scan/orchestration"
import { activeRunStatuses, finalRunStatus } from "@/domain/scan/run"
import { parseSourceDate } from "@/domain/scan/source-date"
import type { ScanSourceDefinition } from "@/domain/scan/source"
import {
  sourceAutoPublishes,
  sourceParticipates,
} from "@/domain/scan/source-lifecycle"
import {
  scanRunStatusLabels,
  type ScanRunSourceStatus,
} from "@/domain/scan/vocabulary"
import { discoveryWindow, windowDecision } from "@/domain/scan/window"
import { db } from "@/lib/db"
import {
  departments,
  scanCandidates,
  scanReviews,
  scanRuns,
  scanRunSources,
  scanSources,
  type ScanCandidate,
  type ScanRun,
  type ScanRunSource,
} from "@/lib/db/schema"
import { sendEmail } from "@/lib/email/send"
import { scanRunReportEmail } from "@/lib/email/templates"
import { env } from "@/lib/env"
import { getBlockedDomains } from "@/server/offers/application"

import {
  deliverCandidate,
  excludeCandidate,
  markGone,
  nextPistesToProcess,
  recordFailure,
  recordListedPosting,
  stageCandidate,
  type CandidateDelivery,
} from "./candidates"
import { withRunClaim } from "./claim"
import { findDuplicateSuspects } from "./duplicates"
import { publishCandidate } from "./publication"
import { claimRun, markProgress } from "./runs"
import {
  initRunSources,
  updateRunSource,
  waitBeforeNextRequest,
} from "./run-sources"
import {
  createAdapterContext,
  type AdapterContext,
  type ListCursor,
  type ListedPosting,
  type ScanAdapter,
} from "./sources/adapter"
import { scanAdapter } from "./sources/adapters"
import { applyCircuitBreaker } from "./sources/health"
import {
  getScanSource,
  getScanSourceDefinition,
  isSourceAdapterAvailable,
  listRunnableSources,
} from "./sources/registry"

// Corps des étapes du workflow du scan (plan scan 09, src/workflows/scan-steps.ts). Entrées et
// sorties minuscules ; chaque écriture porte le jeton du passage (withRunClaim) et se rejoue sans
// double comptage. Une source qui ne participe plus, bloquée ou indisponible s'arrête seule.

export type StepStop =
  | "superseded"
  | "stop_requested"
  | "not_participating"
  | "blocked"
  | "unavailable"
  | "finished"

const log = (event: string, details: Record<string, unknown> = {}) =>
  console.info(`[scan passage] ${event}`, JSON.stringify(details))

async function claimedRun(runId: string, token: string) {
  const [run] = await db
    .select()
    .from(scanRuns)
    .where(
      and(
        eq(scanRuns.id, runId),
        eq(scanRuns.claimToken, token),
        inArray(scanRuns.status, activeRunStatuses),
      ),
    )
  return run ?? null
}

async function runSource(runId: string, key: string) {
  const [row] = await db
    .select()
    .from(scanRunSources)
    .where(
      and(eq(scanRunSources.runId, runId), eq(scanRunSources.sourceKey, key)),
    )
  return row ?? null
}

// Fin d'une source dans ce passage ; un arrêt pour refus d'accès ouvre (ou rouvre) une revue
// `incident` regroupée par source et par motif.
async function closeRunSource(
  runId: string,
  token: string,
  key: string,
  status: Extract<
    ScanRunSourceStatus,
    "done" | "failed" | "blocked" | "skipped"
  >,
  { error, reason }: { error?: string; reason?: ScanFailureReason } = {},
) {
  return withRunClaim(runId, token, async (tx) => {
    const now = new Date()
    await tx
      .update(scanRunSources)
      .set({ status, lastError: error ?? null, finishedAt: now })
      .where(
        and(eq(scanRunSources.runId, runId), eq(scanRunSources.sourceKey, key)),
      )
    if (status === "blocked" && reason) {
      const details = { reason, label: scanFailureLabels[reason], runId }
      await tx
        .insert(scanReviews)
        .values({
          kind: "incident",
          groupKey: `source:${key}:${reason}`,
          sourceKey: key,
          details,
        })
        .onConflictDoUpdate({
          target: [scanReviews.kind, scanReviews.groupKey],
          set: {
            status: "open",
            decidedAt: null,
            decidedByUserId: null,
            decision: null,
            occurrences: sql`${scanReviews.occurrences} + 1`,
            lastSeenAt: now,
            details,
          },
        })
    }
    return { ok: true } as const
  })
}

type Usage = {
  requests: number
  bytes: number
  robotsDigest?: string
  lastRequestAt?: Date
}

// Contexte d'un adaptateur pour une étape : lectures comptées (requêtes, octets) et empreinte du
// robots.txt de la source (disjoncteur du lot E).
function stepContext(
  definition: ScanSourceDefinition,
  departmentCodes: readonly string[],
  deadline: number,
) {
  const usage: Usage = { requests: 0, bytes: 0 }
  const base = createAdapterContext(definition, {
    departmentCodes,
    deadline,
    log: (event, details) => log(event, { source: definition.key, ...details }),
  })
  const ctx: AdapterContext = {
    ...base,
    async scanFetch(url, options) {
      const result = await base.scanFetch(url, options)
      usage.requests += 1
      usage.lastRequestAt = new Date()
      if (result.ok) usage.bytes += result.bytes
      for (const robots of result.robots) {
        if (
          robots.digest !== undefined &&
          URL.canParse(robots.url) &&
          definition.officialHosts.includes(new URL(robots.url).hostname)
        )
          usage.robotsDigest = robots.digest
      }
      return result
    },
  }
  return { ctx, usage }
}

function usagePatch(usage: Usage) {
  return {
    requestCount: usage.requests,
    bytesDownloaded: usage.bytes,
    ...(usage.robotsDigest !== undefined
      ? { robotsDigest: usage.robotsDigest }
      : {}),
    ...(usage.lastRequestAt ? { lastRequestAt: usage.lastRequestAt } : {}),
  }
}

async function departmentCodes() {
  const rows = await db.select({ code: departments.code }).from(departments)
  return rows.map((row) => row.code)
}

type LoadedSource = {
  run: ScanRun
  state: ScanRunSource
  definition: ScanSourceDefinition
  adapter: ScanAdapter
  autoPublishes: boolean
}

// État courant relu avant chaque lot (SH22) : jeton, arrêt demandé, interrupteurs de la source,
// version figée par le passage.
async function loadSource(
  runId: string,
  token: string,
  key: string,
): Promise<{ ok: true; source: LoadedSource } | { ok: false; stop: StepStop }> {
  const run = await claimedRun(runId, token)
  if (!run) return { ok: false, stop: "superseded" }
  if (run.stopRequestedAt || run.status === "stopping")
    return { ok: false, stop: "stop_requested" }
  const state = await runSource(runId, key)
  if (!state || ["done", "failed", "blocked", "skipped"].includes(state.status))
    return { ok: false, stop: "finished" }
  const row = await getScanSource(key)
  const adapterAvailable = !!row && isSourceAdapterAvailable(row)
  if (!row || !sourceParticipates(row, run.mode, { adapterAvailable })) {
    await closeRunSource(runId, token, key, "skipped", {
      error: "Désactivée pendant le passage",
    })
    log("source non couverte", { runId, source: key })
    return { ok: false, stop: "not_participating" }
  }
  const definition = await getScanSourceDefinition(key, {
    revision: state.sourceRevision,
  })
  const adapter = definition ? scanAdapter(definition.adapter) : null
  if (!definition || !adapter) {
    await closeRunSource(runId, token, key, "failed", {
      error: "Configuration ou connecteur indisponible",
    })
    return { ok: false, stop: "unavailable" }
  }
  return {
    ok: true,
    source: {
      run,
      state,
      definition,
      adapter,
      autoPublishes: sourceAutoPublishes(row, { adapterAvailable }),
    },
  }
}

const maxPostings = (definition: ScanSourceDefinition) =>
  Math.min(
    definition.limits.maxPostings ?? scanLimits.maxPostings,
    scanLimits.maxPostings,
  )

// --- Prise du passage -------------------------------------------------------------------------

export type ClaimResult =
  | { ok: false; reason: "superseded" }
  | { ok: true; waves: { host: string; sources: string[] }[][] }

export async function claimScanRun(
  runId: string,
  token: string,
  workflowRunId: string,
  now = new Date(),
): Promise<ClaimResult> {
  const claimed = await claimRun(runId, token, workflowRunId, now)
  if (!claimed.ok) {
    // Arrêt demandé avant la prise : le passage se termine « arrêté », sans lecture.
    const run = await claimedRun(runId, token)
    return run?.status === "stopping"
      ? { ok: true, waves: [] }
      : { ok: false, reason: "superseded" }
  }
  const runnable = await listRunnableSources(claimed.run.mode)
  const init = await initRunSources(
    runId,
    runnable.map((source) => source.key),
    token,
  )
  if (!init.ok) return { ok: false, reason: "superseded" }
  const states = await db
    .select()
    .from(scanRunSources)
    .where(eq(scanRunSources.runId, runId))
  const order = new Map(runnable.map((source, index) => [source.key, index]))
  const planned: { key: string; host: string }[] = []
  for (const state of states.sort(
    (a, b) =>
      (order.get(a.sourceKey) ?? Infinity) -
      (order.get(b.sourceKey) ?? Infinity),
  )) {
    // Terminée ou bloquée : rien à reprendre dans ce passage.
    if (state.status === "done" || state.status === "blocked") continue
    if (state.status === "failed" || state.status === "skipped")
      await updateRunSource(runId, state.sourceKey, token, {
        status: state.cursor
          ? "listing"
          : state.listedCount
            ? "processing"
            : "pending",
        lastError: null,
        finishedAt: null,
      })
    const definition = await getScanSourceDefinition(state.sourceKey, {
      revision: state.sourceRevision,
    })
    planned.push({
      key: state.sourceKey,
      host: definition
        ? new URL(definition.listUrls[0]).hostname
        : state.sourceKey,
    })
  }
  log("passage pris", { runId, workflowRunId, sources: planned.length })
  return { ok: true, waves: planDomains(planned) }
}

// --- Liste ------------------------------------------------------------------------------------

export type ListStepResult = {
  next: boolean
  listed: number
  stop?: StepStop
  retryAfterMs?: number
}

export async function listSourcePage(
  runId: string,
  token: string,
  key: string,
  now = new Date(),
): Promise<ListStepResult> {
  const loaded = await loadSource(runId, token, key)
  if (!loaded.ok) return { next: false, listed: 0, stop: loaded.stop }
  const { run, state, definition, adapter } = loaded.source
  // Liste déjà parcourue (reprise) : place aux fiches.
  if (state.status === "processing") return { next: false, listed: 0 }
  const remaining = maxPostings(definition) - state.listedCount
  if (remaining <= 0) {
    await updateRunSource(runId, key, token, {
      status: "processing",
      cursor: null,
    })
    return { next: false, listed: 0 }
  }
  const { ctx, usage } = stepContext(
    definition,
    await departmentCodes(),
    Date.now() + scanLimits.batchBudgetMs,
  )
  let page: Awaited<ReturnType<ScanAdapter["listPage"]>>
  try {
    page = await adapter.listPage(
      ctx,
      (state.cursor as ListCursor | null) ?? null,
    )
  } catch (error) {
    log("liste illisible", { runId, source: key, error: String(error) })
    page = { kind: "unavailable", reason: "network" }
  }
  if (page.kind !== "listed") {
    await updateRunSource(runId, key, token, usagePatch(usage))
    if (page.kind === "rate_limited")
      return {
        next: true,
        listed: 0,
        retryAfterMs: page.retryAfterMs ?? scanLimits.defaultRetryAfterMs,
      }
    await closeRunSource(
      runId,
      token,
      key,
      page.kind === "blocked" ? "blocked" : "failed",
      { error: scanFailureLabels[page.reason], reason: page.reason },
    )
    log("source arrêtée", { runId, source: key, reason: page.reason })
    return {
      next: false,
      listed: 0,
      stop: page.kind === "blocked" ? "blocked" : "unavailable",
    }
  }
  const window = discoveryWindow(run.mode, run.startedAt)
  const postings = page.postings.slice(0, remaining)
  for (const posting of postings) {
    const recorded = await recordListedPosting(runId, token, key, {
      identityKey: posting.identityKey,
      discoveryUrl: posting.url,
      externalId: posting.externalId,
      listingHash: posting.listingHash,
      listing: {
        ...(posting.title ? { title: posting.title } : {}),
        ...(posting.sourceDate ? { sourceDate: posting.sourceDate } : {}),
        ...(posting.index !== undefined ? { index: posting.index } : {}),
        data: posting.data,
      },
      now,
    })
    if (!recorded.ok) return { next: false, listed: 0, stop: "superseded" }
    // Hors périmètre dès la liste : écarté sans lecture de sa fiche.
    const listedDate = posting.sourceDate
      ? parseSourceDate(posting.sourceDate)
      : null
    if (
      run.mode === "daily" &&
      recorded.kind !== "skip_excluded" &&
      windowDecision(listedDate, window) === "outside"
    )
      await excludeCandidate({
        candidateId: recorded.candidate.id,
        runId,
        token,
        reason: "outside_window",
        detail: "Date de la liste hors de la fenêtre du passage",
        now,
      })
  }
  const next =
    page.next && postings.length === page.postings.length ? page.next : null
  await updateRunSource(runId, key, token, {
    ...usagePatch(usage),
    status: next ? "listing" : "processing",
    cursor: next,
    listedCount: postings.length,
    ...(state.startedAt ? {} : { startedAt: now }),
  })
  await markProgress(runId, token, new Date())
  return { next: !!next, listed: postings.length }
}

// --- Fiches -----------------------------------------------------------------------------------

export type BatchStepResult = {
  processed: number
  delivered: number
  published: number
  done: boolean
  stop?: StepStop
  retryAfterMs?: number
}

type PisteOutcome =
  | { kind: "delivered" | "published" | "excluded" | "failed" | "skipped" }
  | { kind: "stop"; stop: StepStop; retryAfterMs?: number }

function listedFrom(piste: ScanCandidate): ListedPosting {
  return {
    url: piste.discoveryUrl,
    identityKey: piste.identityKey,
    externalId: piste.externalId ?? undefined,
    listingHash: piste.listingHash ?? "",
    title: piste.listing?.title,
    sourceDate: piste.listing?.sourceDate,
    index: piste.listing?.index,
    data: piste.listing?.data ?? {},
  }
}

// Une page à plusieurs postes (plan 05) : la piste de base porte le premier, chacun des autres a
// sa piste `<identité>#<index>`, enregistrée à la première lecture.
const blockIndex = (identityKey: string) => {
  const match = /#(\d+)$/.exec(identityKey)
  return match ? Number(match[1]) : null
}

async function processPiste(
  source: LoadedSource,
  ctx: AdapterContext,
  piste: ScanCandidate,
  context: { blockedDomains: readonly string[] },
): Promise<PisteOutcome> {
  const { run, definition, adapter } = source
  const runId = run.id,
    token = run.claimToken
  const now = new Date()
  let read: Awaited<ReturnType<ScanAdapter["readPosting"]>>
  try {
    read = await adapter.readPosting(ctx, listedFrom(piste))
  } catch (error) {
    log("fiche illisible", { runId, piste: piste.id, error: String(error) })
    read = { kind: "unreadable", reason: "invalid_document" }
  }
  if (read.kind === "gone") {
    const gone = await markGone(piste.id, { runId, token, now })
    return gone.ok ? { kind: "failed" } : { kind: "stop", stop: "superseded" }
  }
  if (read.kind === "unreadable") {
    const reason = read.reason
    if (reason === "rate_limited")
      return {
        kind: "stop",
        stop: "unavailable",
        retryAfterMs: scanLimits.defaultRetryAfterMs,
      }
    if (
      reason === "robots_disallowed" ||
      reason === "access_denied" ||
      reason === "blocked_address"
    ) {
      await closeRunSource(runId, token, definition.key, "blocked", {
        error: scanFailureLabels[reason],
        reason,
      })
      log("source bloquée", { runId, source: definition.key, reason })
      return { kind: "stop", stop: "blocked" }
    }
    const failed = await recordFailure(
      piste.id,
      reason === "invalid_document"
        ? "Document illisible"
        : scanFailureLabels[reason],
      { runId, token, expectedAttempts: piste.attempts, now },
    )
    if (!failed.ok) return { kind: "stop", stop: "superseded" }
    // Hôte en panne (délai, réseau) : la source s'arrête pour ce passage (SH12).
    if (reason !== "invalid_document" && stopsSource(reason)) {
      await closeRunSource(runId, token, definition.key, "failed", {
        error: scanFailureLabels[reason],
      })
      return { kind: "stop", stop: "unavailable" }
    }
    return { kind: "failed" }
  }
  const postings = read.postings ?? [read.posting]
  const index = blockIndex(piste.identityKey)
  const posting: ExtractedPosting | undefined =
    index === null
      ? postings[0]
      : postings.find((candidate) => candidate.index === index)
  if (index === null && postings.length > 1) {
    for (const extra of postings.slice(1)) {
      if (extra.index === undefined) continue
      const recorded = await recordListedPosting(runId, token, definition.key, {
        identityKey: `${piste.identityKey}#${extra.index}`,
        discoveryUrl: piste.discoveryUrl,
        externalId: piste.externalId ?? undefined,
        listingHash: `${piste.listingHash ?? ""}#${extra.index}`,
        listing: { ...(piste.listing ?? { data: {} }), index: extra.index },
        now,
      })
      if (!recorded.ok) return { kind: "stop", stop: "superseded" }
    }
  }
  if (!posting) {
    const gone = await markGone(piste.id, { runId, token, now })
    return gone.ok ? { kind: "failed" } : { kind: "stop", stop: "superseded" }
  }
  const fixture = definition.adapter === "fixture"
  const admission = admitPosting(posting, {
    mode: run.mode,
    window: discoveryWindow(run.mode, run.startedAt),
    today: todayInParis(now),
    now: now.toISOString(),
    testMode: fixture,
    source: {
      kind: definition.kind,
      officialHosts: definition.officialHosts,
      postingUrlPattern: definition.postingUrlPattern,
      test: fixture,
      // Une source employeur est qualifiée comme employeur du tourisme (preuve de rattachement).
      tourism: definition.kind === "employer",
      evidence: {
        kind: "listing",
        scope: "site",
        locator: definition.affiliationProof.url,
        excerpt: definition.affiliationProof.note.slice(0, 300),
      },
    },
    blockedDomains: context.blockedDomains,
  })
  if (!admission.admitted) {
    const excluded = await excludeCandidate({
      candidateId: piste.id,
      runId,
      token,
      reason: admission.reason,
      detail: admission.detail,
      now,
    })
    return excluded.ok
      ? { kind: "excluded" }
      : { kind: "stop", stop: "superseded" }
  }
  const duplicates = await findDuplicateSuspects(piste, admission.proposal, {
    runId,
    token,
  })
  if (!duplicates.ok) return { kind: "stop", stop: "superseded" }
  if (duplicates.alreadyKnown) return { kind: "excluded" }
  const delivery: CandidateDelivery = {
    candidateId: piste.id,
    runId,
    token,
    extraction: { ...posting, extractorVersion: adapter.extractorVersion },
    admission,
    proposal: admission.proposal,
    now: new Date(),
  }
  // Publication automatique : passage quotidien, source autorisée, aucun point bloquant ni
  // doublon potentiel (SH4) ; publishCandidate revérifie tout dans sa transaction.
  if (
    run.mode === "daily" &&
    source.autoPublishes &&
    admission.blocking.length === 0 &&
    duplicates.suspects.length === 0
  ) {
    const staged = await stageCandidate(delivery)
    if (!staged.ok) return { kind: "stop", stop: "superseded" }
    const published = await publishCandidate({
      candidateId: piste.id,
      kind: "scan",
      runId,
      token,
    })
    if (published.ok) return { kind: "published" }
  }
  const delivered = await deliverCandidate(delivery)
  if (!delivered.ok) return { kind: "stop", stop: "superseded" }
  return { kind: delivered.delivered ? "delivered" : "skipped" }
}

export async function processSourceBatch(
  runId: string,
  token: string,
  key: string,
): Promise<BatchStepResult> {
  const result: BatchStepResult = {
    processed: 0,
    delivered: 0,
    published: 0,
    done: false,
  }
  const loaded = await loadSource(runId, token, key)
  if (!loaded.ok) return { ...result, stop: loaded.stop }
  const { state, definition } = loaded.source
  const startedAt = Date.now()
  const { ctx, usage } = stepContext(
    definition,
    await departmentCodes(),
    startedAt + scanLimits.batchBudgetMs,
  )
  const blockedDomains = await getBlockedDomains()
  if (state.status !== "processing")
    await updateRunSource(runId, key, token, {
      status: "processing",
      cursor: null,
      ...(state.startedAt ? {} : { startedAt: new Date() }),
    })
  // Politesse entre deux étapes : l'intervalle part de la dernière requête enregistrée.
  const wait = await waitBeforeNextRequest(
    runId,
    key,
    Math.max(definition.limits.minIntervalMs ?? 0, scanLimits.minIntervalMs),
  )
  if (wait > 0) await delay(wait)
  try {
    while (canStartPosting(startedAt, Date.now())) {
      const run = await claimedRun(runId, token)
      if (!run) return { ...result, stop: "superseded" }
      if (run.stopRequestedAt) return { ...result, stop: "stop_requested" }
      if (state.fetchedCount + result.processed >= maxPostings(definition)) {
        await closeRunSource(runId, token, key, "done")
        return { ...result, done: true }
      }
      const [piste] = await nextPistesToProcess(runId, key, 1)
      if (!piste) {
        await closeRunSource(runId, token, key, "done")
        return { ...result, done: true }
      }
      const outcome = await processPiste(loaded.source, ctx, piste, {
        blockedDomains,
      })
      if (outcome.kind === "stop") {
        return {
          ...result,
          stop: outcome.retryAfterMs ? undefined : outcome.stop,
          retryAfterMs: outcome.retryAfterMs,
        }
      }
      result.processed += 1
      if (outcome.kind === "delivered") result.delivered += 1
      if (outcome.kind === "published") result.published += 1
    }
    return result
  } finally {
    // Requêtes et octets comptés, même quand l'étape s'arrête en cours de lot.
    const flushed = await updateRunSource(runId, key, token, {
      ...usagePatch(usage),
      fetchedCount: result.processed,
    })
    if (flushed.ok) await markProgress(runId, token, new Date())
  }
}

// --- Fin du passage ---------------------------------------------------------------------------

const purgeAfterMs = 90 * 24 * 60 * 60 * 1_000

export type FinishResult =
  | { ok: false; reason: "superseded" }
  | {
      ok: true
      status: ScanRun["status"]
      suspended: string[]
      reportSent: boolean
    }

export async function finishScanRun(
  runId: string,
  token: string,
  now = new Date(),
): Promise<FinishResult> {
  const finished = await withRunClaim(runId, token, async (tx, run) => {
    const sources = await tx
      .select({ status: scanRunSources.status })
      .from(scanRunSources)
      .where(eq(scanRunSources.runId, runId))
    const status = finalRunStatus(sources, {
      stopRequested: !!run.stopRequestedAt,
    })
    await tx
      .update(scanRuns)
      .set({ status, finishedAt: now, lastProgressAt: now })
      .where(eq(scanRuns.id, runId))
    // Contrat du lot E du plan V2-01 : disjoncteur dans la transaction de fin.
    const suspended = await applyCircuitBreaker(tx, runId, now)
    // SH13 : texte et observations des dossiers écartés, échoués ou rejetés effacés après 90 jours.
    if (run.mode === "daily")
      await tx
        .update(scanCandidates)
        .set({ pageText: null, observations: [] })
        .where(
          and(
            inArray(scanCandidates.status, ["excluded", "failed", "rejected"]),
            lt(
              scanCandidates.updatedAt,
              new Date(now.getTime() - purgeAfterMs),
            ),
          ),
        )
    const [incidents] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(scanReviews)
      .where(
        and(
          eq(scanReviews.kind, "incident"),
          eq(scanReviews.status, "open"),
          gte(scanReviews.lastSeenAt, run.startedAt),
        ),
      )
    const [current] = await tx
      .select({ deliveredCount: scanRuns.deliveredCount })
      .from(scanRuns)
      .where(eq(scanRuns.id, runId))
    // SH16 : un seul bilan, posé avant l'envoi ; un passage quotidien sans dossier ni incident
    // n'envoie rien.
    const worthReporting =
      run.mode === "bootstrap" ||
      current.deliveredCount > 0 ||
      incidents.count > 0 ||
      suspended.length > 0
    const [claimed] = worthReporting
      ? await tx
          .update(scanRuns)
          .set({ reportSentAt: now })
          .where(and(eq(scanRuns.id, runId), isNull(scanRuns.reportSentAt)))
          .returning({ id: scanRuns.id })
      : []
    return {
      ok: true,
      status,
      suspended: suspended.map((source) => source.label),
      sendReport: !!claimed,
    } as const
  })
  if (!finished.ok) return { ok: false, reason: "superseded" }
  log("passage terminé", { runId, status: finished.status })
  if (finished.sendReport) await sendRunReport(runId, finished.suspended)
  return {
    ok: true,
    status: finished.status,
    suspended: finished.suspended,
    reportSent: finished.sendReport,
  }
}

const parisDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "long",
})
const parisDateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "long",
  timeStyle: "short",
})

// Un échec d'envoi est journalisé, jamais réessayé en boucle (reportSentAt est déjà posé).
async function sendRunReport(runId: string, suspended: string[]) {
  try {
    const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, runId))
    const blocked = await db
      .select({ label: scanSources.label })
      .from(scanRunSources)
      .innerJoin(scanSources, eq(scanSources.key, scanRunSources.sourceKey))
      .where(
        and(
          eq(scanRunSources.runId, runId),
          inArray(scanRunSources.status, ["blocked", "failed"]),
        ),
      )
    const [automatic] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanCandidates)
      .where(
        and(
          eq(scanCandidates.deliveredRunId, runId),
          eq(scanCandidates.publicationKind, "automatic"),
        ),
      )
    await sendEmail({
      to: env.ADMIN_NOTIFICATION_EMAIL,
      ...scanRunReportEmail({
        mode: run.mode,
        statusLabel: scanRunStatusLabels[run.status].toLowerCase(),
        date: parisDate.format(run.startedAt),
        delivered: run.deliveredCount,
        target: run.targetCount,
        targetReachedAt: run.targetReachedAt
          ? parisDateTime.format(run.targetReachedAt)
          : null,
        automaticPublications: automatic.count,
        blockedSources: blocked.map((source) => source.label),
        suspendedSources: suspended,
        url: new URL(`/admin/scan/passages/${runId}`, env.BETTER_AUTH_URL).href,
      }),
    })
  } catch (error) {
    console.error(`[scan passage] bilan non envoyé ${runId}`, error)
  }
}
