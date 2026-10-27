import "server-only"

import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm"

import {
  autoPublishReadiness,
  qualificationDue,
  robotsChanged,
  shouldSuspendSource,
  sourceHealth,
  type RunSourceOutcome,
  type SourceHealth,
} from "@/domain/scan/source-health"
import type { ScanSourceDraftSnapshot } from "@/domain/scan/source"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanReviews,
  scanRunSources,
  scanRuns,
  scanSourceEvents,
  scanSourceRevisions,
  scanSources,
} from "@/lib/db/schema"

import type { ScanTransaction } from "../claim"
import { isScanSourceKey } from "./registry"
import {
  lockScanSource,
  recordSourceEvent,
  sourceConflict,
  unknownSource,
  type SourceWriteResult,
} from "./writes"

// Santé, rendement et disjoncteur des sources (lot E, D9). Le branchement dans la fin de
// passage revient au plan scan 09 : `applyCircuitBreaker` s'y appelle dans la transaction de
// fin, et renvoie les suspensions pour la ligne du bilan (SH16).
type Reader = typeof db | ScanTransaction

const day = 24 * 60 * 60 * 1_000

// Derniers passages d'une ou plusieurs sources, du plus récent au plus ancien.
async function recentRuns(keys: string[], tx: Reader = db, limit = 10) {
  if (!keys.length)
    return new Map<string, (RunSourceOutcome & { runId: string })[]>()
  const rows = await tx
    .select({
      sourceKey: scanRunSources.sourceKey,
      runId: scanRunSources.runId,
      status: scanRunSources.status,
      failedCount: scanRunSources.failedCount,
      robotsDigest: scanRunSources.robotsDigest,
      mode: scanRuns.mode,
      startedAt: scanRuns.startedAt,
    })
    .from(scanRunSources)
    .innerJoin(scanRuns, eq(scanRuns.id, scanRunSources.runId))
    .where(inArray(scanRunSources.sourceKey, keys))
    .orderBy(desc(scanRuns.startedAt))
  const runs = new Map<string, (RunSourceOutcome & { runId: string })[]>()
  for (const row of rows) {
    const list = runs.get(row.sourceKey) ?? []
    if (list.length < limit) list.push(row)
    runs.set(row.sourceKey, list)
  }
  return runs
}

export type SourceHealthSummary = {
  health: SourceHealth
  robotsChanged: boolean
  qualificationDue: boolean
}
export async function sourceHealthSummaries(today = new Date()) {
  const rows = await db
    .select({ row: scanSources, revision: scanSourceRevisions })
    .from(scanSources)
    .innerJoin(
      scanSourceRevisions,
      and(
        eq(scanSourceRevisions.sourceKey, scanSources.key),
        eq(scanSourceRevisions.revision, scanSources.revision),
      ),
    )
  const runs = await recentRuns(rows.map(({ row }) => row.key))
  return new Map(
    rows.map(({ row, revision }) => {
      const definition = revision.definition as ScanSourceDraftSnapshot
      const checked =
        [definition.affiliationProof?.checkedAt, definition.reuse?.checkedAt]
          .filter((date): date is string => !!date)
          .sort()
          .at(-1) ?? null
      const sourceRuns = runs.get(row.key) ?? []
      return [
        row.key,
        {
          health: sourceHealth(sourceRuns, { suspended: !!row.suspendedAt }),
          robotsChanged: robotsChanged(sourceRuns),
          qualificationDue:
            row.status === "ready" && qualificationDue(checked, today),
        } satisfies SourceHealthSummary,
      ]
    }),
  )
}

// Onglet « Activité » : sur 30 jours, rendement et coût d'une source.
export async function sourceActivity(key: string, today = new Date()) {
  const since = new Date(today.getTime() - 30 * day)
  const [totals] = await db
    .select({
      runs: count(),
      listed: sql<number>`coalesce(sum(${scanRunSources.listedCount}), 0)::int`,
      fetched: sql<number>`coalesce(sum(${scanRunSources.fetchedCount}), 0)::int`,
      delivered: sql<number>`coalesce(sum(${scanRunSources.deliveredCount}), 0)::int`,
      excluded: sql<number>`coalesce(sum(${scanRunSources.excludedCount}), 0)::int`,
      failed: sql<number>`coalesce(sum(${scanRunSources.failedCount}), 0)::int`,
      requests: sql<number>`coalesce(sum(${scanRunSources.requestCount}), 0)::int`,
      bytes: sql<number>`coalesce(sum(${scanRunSources.bytesDownloaded}), 0)::bigint`,
    })
    .from(scanRunSources)
    .innerJoin(scanRuns, eq(scanRuns.id, scanRunSources.runId))
    .where(
      and(eq(scanRunSources.sourceKey, key), gte(scanRuns.startedAt, since)),
    )
  const [exclusions, rejections, publications, [pending], [incidents], runs] =
    await Promise.all([
      db
        .select({ reason: scanCandidates.exclusionReason, count: count() })
        .from(scanCandidates)
        .where(
          and(
            eq(scanCandidates.sourceKey, key),
            eq(scanCandidates.status, "excluded"),
            gte(scanCandidates.lastSeenAt, since),
          ),
        )
        .groupBy(scanCandidates.exclusionReason),
      db
        .select({ reason: scanCandidates.rejectionReason, count: count() })
        .from(scanCandidates)
        .where(
          and(
            eq(scanCandidates.sourceKey, key),
            eq(scanCandidates.status, "rejected"),
            gte(scanCandidates.decidedAt, since),
          ),
        )
        .groupBy(scanCandidates.rejectionReason),
      db
        .select({ kind: scanCandidates.publicationKind, count: count() })
        .from(scanCandidates)
        .where(
          and(
            eq(scanCandidates.sourceKey, key),
            eq(scanCandidates.status, "published"),
            gte(scanCandidates.decidedAt, since),
          ),
        )
        .groupBy(scanCandidates.publicationKind),
      db
        .select({ count: count() })
        .from(scanCandidates)
        .where(
          and(
            eq(scanCandidates.sourceKey, key),
            eq(scanCandidates.status, "to_review"),
          ),
        ),
      db
        .select({ count: count() })
        .from(scanReviews)
        .where(
          and(
            eq(scanReviews.sourceKey, key),
            eq(scanReviews.kind, "incident"),
            eq(scanReviews.status, "open"),
          ),
        ),
      db
        .select({
          runId: scanRuns.id,
          mode: scanRuns.mode,
          startedAt: scanRuns.startedAt,
          status: scanRunSources.status,
          sourceRevision: scanRunSources.sourceRevision,
          listed: scanRunSources.listedCount,
          delivered: scanRunSources.deliveredCount,
          failed: scanRunSources.failedCount,
          lastError: scanRunSources.lastError,
          robotsDigest: scanRunSources.robotsDigest,
          failedCount: scanRunSources.failedCount,
        })
        .from(scanRunSources)
        .innerJoin(scanRuns, eq(scanRuns.id, scanRunSources.runId))
        .where(eq(scanRunSources.sourceKey, key))
        .orderBy(desc(scanRuns.startedAt))
        .limit(10),
    ])
  return {
    totals: { ...totals, bytes: Number(totals.bytes) },
    exclusions,
    rejections,
    publications: {
      human: publications.find((row) => row.kind === "human")?.count ?? 0,
      automatic:
        publications.find((row) => row.kind === "automatic")?.count ?? 0,
    },
    pending: pending.count,
    incidents: incidents.count,
    runs,
    autoPublish: autoPublishReadiness(runs),
  }
}
export type SourceActivity = Awaited<ReturnType<typeof sourceActivity>>

// D9 : en fin de passage, une source bloquée trois passages de suite est suspendue, avec un
// incident en revue et une ligne pour le bilan. À appeler dans la transaction de fin.
export async function applyCircuitBreaker(
  tx: ScanTransaction,
  runId: string,
  now = new Date(),
) {
  const keys = (
    await tx
      .select({ key: scanRunSources.sourceKey })
      .from(scanRunSources)
      .where(eq(scanRunSources.runId, runId))
  ).map((row) => row.key)
  const runs = await recentRuns(keys, tx, 5)
  const suspended: { key: string; label: string }[] = []
  for (const key of keys) {
    const lastRuns = runs.get(key) ?? []
    if (!shouldSuspendSource(lastRuns)) continue
    const row = await lockScanSource(tx, key)
    if (!row || row.suspendedAt) continue
    const reason =
      "Trois passages consécutifs bloqués (robots.txt, 401 ou 403) : source suspendue."
    await tx
      .update(scanSources)
      .set({
        suspendedAt: now,
        suspensionReason: reason,
        version: row.version + 1,
      })
      .where(eq(scanSources.key, key))
    await recordSourceEvent(
      tx,
      key,
      {
        kind: "suspended",
        details: {
          reason,
          runIds: lastRuns.slice(0, 3).map((run) => run.runId),
        },
      },
      { actorUserId: null, revision: row.revision },
    )
    await tx
      .insert(scanReviews)
      .values({
        kind: "incident",
        groupKey: `source:${key}:suspendue`,
        sourceKey: key,
        details: { reason, runId },
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
          details: { reason, runId },
        },
      })
    suspended.push({ key, label: row.label })
  }
  return suspended
}

// « Reprendre » exige un test réussi de la configuration actuelle depuis la suspension.
export async function resumeSource(
  key: string,
  version: number,
  adminId: string,
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  return db.transaction(async (tx) => {
    const row = await lockScanSource(tx, key)
    if (!row) return unknownSource
    if (row.version !== version) return sourceConflict
    if (!row.suspendedAt) return { ok: true, version: row.version, key }
    const [revision] = await tx
      .select({ configHash: scanSourceRevisions.configHash })
      .from(scanSourceRevisions)
      .where(
        and(
          eq(scanSourceRevisions.sourceKey, key),
          eq(scanSourceRevisions.revision, row.revision),
        ),
      )
    const [test] = await tx
      .select({ id: scanSourceEvents.id })
      .from(scanSourceEvents)
      .where(
        and(
          eq(scanSourceEvents.sourceKey, key),
          inArray(scanSourceEvents.kind, ["probed", "sampled"]),
          gt(scanSourceEvents.createdAt, row.suspendedAt),
          sql`${scanSourceEvents.details}->>'configHash' = ${revision.configHash}`,
          sql`${scanSourceEvents.details}->>'status' = 'done'`,
          sql`(${scanSourceEvents.details}->>'ok')::boolean`,
        ),
      )
      .limit(1)
    if (!test)
      return {
        ok: false,
        reason: "blocked",
        message:
          "Testez la source (accès ou échantillon réussi) avant de la reprendre.",
      }
    const next = row.version + 1
    await tx
      .update(scanSources)
      .set({
        suspendedAt: null,
        suspensionReason: null,
        version: next,
        updatedByUserId: adminId,
      })
      .where(eq(scanSources.key, key))
    await recordSourceEvent(
      tx,
      key,
      { kind: "resumed", details: { testId: test.id } },
      { actorUserId: adminId, revision: row.revision },
    )
    await tx
      .update(scanReviews)
      .set({
        status: "resolved",
        decidedAt: new Date(),
        decidedByUserId: adminId,
        decision: { decision: "resumed", testId: test.id },
      })
      .where(
        and(
          eq(scanReviews.kind, "incident"),
          eq(scanReviews.groupKey, `source:${key}:suspendue`),
          eq(scanReviews.status, "open"),
        ),
      )
    return { ok: true, version: next, key }
  })
}
