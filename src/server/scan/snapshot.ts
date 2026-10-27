import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm"
import { z } from "zod"

import { activeRunStatuses } from "@/domain/scan/run"
import type { ScanQueueItem, ScanSnapshot } from "@/domain/scan/queue"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanReviews,
  scanRuns,
  scanRunSources,
  scanSources,
} from "@/lib/db/schema"

// Drizzle déqualifie les colonnes d'un SELECT à une table ; garder l'identité
// extérieure qualifiée dans la sous-requête corrélée sur les doublons.
const candidateIdentity = sql`"scan_candidates"."id"`
const queueColumns = {
  id: scanCandidates.id,
  title: sql<string | null>`left(${scanCandidates.title}, 150)`,
  sourceKey: scanCandidates.sourceKey,
  // Libellé courant de la source, par jointure (clé étrangère : jamais « inconnue »).
  sourceLabel: scanSources.label,
  status: scanCandidates.status,
  readyForReviewAt: scanCandidates.readyForReviewAt,
  companyName: sql<
    string | null
  >`left(${scanCandidates.proposal}->'company'->'value'->>'name', 150)`,
  location: sql<
    string | null
  >`left(${scanCandidates.proposal}->'locations'->'value'->0->>'communeName', 150)`,
  blockingCount: sql<number>`(select count(*)::int from jsonb_array_elements(${scanCandidates.issues}) issue where issue->>'blocking' = 'true' and issue->>'code' not in ('duplicate', 'season_contradiction') and not (issue->>'code' = 'seasonal_contract' and coalesce(issue->>'field', '') = 'season')) + case when exists (select 1 from ${scanReviews} where ${scanReviews.kind} = 'duplicate' and ${scanReviews.status} = 'open' and (${scanReviews.candidateId} = ${candidateIdentity} or ${scanReviews.otherCandidateId} = ${candidateIdentity})) then 1 else 0 end`,
  alertCount: sql<number>`(select count(*)::int from jsonb_array_elements(${scanCandidates.issues}) issue where issue->>'blocking' = 'false' or issue->>'code' = 'season_contradiction' or (issue->>'code' = 'seasonal_contract' and issue->>'field' = 'season'))`,
}
function queueItem(row: {
  id: string
  title: string | null
  sourceKey: string
  sourceLabel: string
  status: ScanQueueItem["status"]
  readyForReviewAt: Date | null
  companyName: string | null
  location: string | null
  blockingCount: number
  alertCount: number
}): ScanQueueItem {
  return {
    ...row,
    title: row.title ?? "Sans intitulé",
    readyForReviewAt: row.readyForReviewAt?.toISOString() ?? "",
  }
}
export function parseReviewCursor(value: string | null) {
  if (!value) return null
  const [date, id] = value.split("|")
  if (
    !z.iso.datetime({ offset: true }).safeParse(date).success ||
    !z.uuid().safeParse(id).success ||
    value.split("|").length !== 2
  )
    throw new RangeError("Curseur invalide")
  return { date: new Date(date), id }
}
export async function getScanSnapshot({
  after = null,
  limit = 50,
  trackedIds = [],
}: {
  after?: string | null
  limit?: number
  trackedIds?: string[]
} = {}): Promise<ScanSnapshot> {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    trackedIds.length > 50
  )
    throw new RangeError("Taille de page invalide")
  const cursor = parseReviewCursor(after)
  const [runRows, states, reviewCounts, page, tracked] = await Promise.all([
    db
      .select()
      .from(scanRuns)
      .orderBy(
        sql`case when ${scanRuns.status} in ('queued','running','stopping') then 0 else 1 end`,
        desc(scanRuns.startedAt),
      )
      .limit(1),
    db
      .select({ status: scanCandidates.status, count: count() })
      .from(scanCandidates)
      .groupBy(scanCandidates.status),
    db
      .select({ kind: scanReviews.kind, count: count() })
      .from(scanReviews)
      .where(eq(scanReviews.status, "open"))
      .groupBy(scanReviews.kind),
    db
      .select(queueColumns)
      .from(scanCandidates)
      .innerJoin(scanSources, eq(scanSources.key, scanCandidates.sourceKey))
      .where(
        and(
          eq(scanCandidates.status, "to_review"),
          cursor
            ? or(
                gt(scanCandidates.readyForReviewAt, cursor.date),
                and(
                  eq(scanCandidates.readyForReviewAt, cursor.date),
                  gt(scanCandidates.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(scanCandidates.readyForReviewAt), asc(scanCandidates.id))
      .limit(limit + 1),
    trackedIds.length
      ? db
          .select(queueColumns)
          .from(scanCandidates)
          .innerJoin(scanSources, eq(scanSources.key, scanCandidates.sourceKey))
          .where(
            and(
              inArray(scanCandidates.id, trackedIds),
              isNotNull(scanCandidates.readyForReviewAt),
            ),
          )
          .limit(50)
      : [],
  ])
  const run = runRows[0]
  const sources = run
    ? await db
        .select({ source: scanRunSources, label: scanSources.label })
        .from(scanRunSources)
        .innerJoin(scanSources, eq(scanSources.key, scanRunSources.sourceKey))
        .where(eq(scanRunSources.runId, run.id))
        .limit(50)
    : []
  const items = page.slice(0, limit).map(queueItem),
    last = items.at(-1)
  return {
    run: run
      ? {
          id: run.id,
          mode: run.mode,
          status: run.status,
          active: activeRunStatuses.some((status) => status === run.status),
          startedAt: run.startedAt.toISOString(),
          deadlineAt: run.deadlineAt?.toISOString() ?? null,
          deliveredCount: run.deliveredCount,
          targetCount: run.targetCount,
          targetReachedAt: run.targetReachedAt?.toISOString() ?? null,
          finishedAt: run.finishedAt?.toISOString() ?? null,
          sources: sources.map(({ source, label }) => ({
            key: source.sourceKey,
            label,
            status: source.status,
            listedCount: source.listedCount,
            fetchedCount: source.fetchedCount,
            deliveredCount: source.deliveredCount,
          })),
        }
      : null,
    counts: {
      toReview:
        states.find((state) => state.status === "to_review")?.count ?? 0,
      published:
        states.find((state) => state.status === "published")?.count ?? 0,
      rejected: states.find((state) => state.status === "rejected")?.count ?? 0,
      excluded: states.find((state) => state.status === "excluded")?.count ?? 0,
      duplicates:
        reviewCounts.find((review) => review.kind === "duplicate")?.count ?? 0,
      suggestions:
        reviewCounts.find((review) => review.kind === "occupation")?.count ?? 0,
    },
    items,
    tracked: tracked.map(queueItem),
    nextCursor:
      page.length > limit && last
        ? `${last.readyForReviewAt}|${last.id}`
        : null,
  }
}
