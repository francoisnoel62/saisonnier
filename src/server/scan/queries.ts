import "server-only"

import { asc, desc, eq, inArray, sql } from "drizzle-orm"

import { activeRunStatuses } from "@/domain/scan/run"
import {
  isAdmissionRejection,
  rejectionReasons,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanReviews,
  scanRuns,
  scanRunSources,
  scanSources,
} from "@/lib/db/schema"

export async function getActiveRun() {
  const [run] = await db
    .select()
    .from(scanRuns)
    .where(inArray(scanRuns.status, activeRunStatuses))
    .limit(1)
  return run ?? null
}

// SH3 : un seul remplissage initial ; une fois créé, l'écran ne propose plus de le lancer.
export async function bootstrapRunExists() {
  const [run] = await db
    .select({ id: scanRuns.id })
    .from(scanRuns)
    .where(eq(scanRuns.runKey, "bootstrap"))
  return !!run
}

export function listRuns(limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200)
    throw new RangeError("Limite invalide")
  return db
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.startedAt), desc(scanRuns.id))
    .limit(limit)
}

export async function getRunState(runId: string) {
  const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, runId))
  if (!run) return null
  const sources = await db
    .select()
    .from(scanRunSources)
    .where(eq(scanRunSources.runId, runId))
    .orderBy(asc(scanRunSources.sourceKey))
  return { run, sources }
}

export async function getRunReport(runId: string) {
  // Une même photographie pour les compteurs, décisions et livraisons du bilan.
  return db.transaction(
    async (tx) => {
      const [run] = await tx
        .select()
        .from(scanRuns)
        .where(eq(scanRuns.id, runId))
      if (!run) return null
      const candidates = tx.$with("run_candidates").as(
        tx
          .select()
          .from(scanCandidates)
          .where(
            sql`${scanCandidates.firstRunId} = ${runId} or ${scanCandidates.deliveredRunId} = ${runId}`,
          ),
      )
      const byStatus = await tx
        .with(candidates)
        .select({
          status: candidates.status,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .groupBy(candidates.status)
      const exclusions = await tx
        .with(candidates)
        .select({
          reason: candidates.exclusionReason,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .where(sql`${candidates.exclusionReason} is not null`)
        .groupBy(candidates.exclusionReason)
      const rejections = await tx
        .with(candidates)
        .select({
          reason: candidates.rejectionReason,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .where(sql`${candidates.rejectionReason} is not null`)
        .groupBy(candidates.rejectionReason)
      const [delivery] = await tx
        .select({
          beforeDeadline: sql<number>`count(*) filter (where ${scanCandidates.readyForReviewAt} <= ${run.deadlineAt})::int`,
          humanPublications: sql<number>`count(*) filter (where ${scanCandidates.publicationKind} = 'human')::int`,
          automaticPublications: sql<number>`count(*) filter (where ${scanCandidates.publicationKind} = 'automatic')::int`,
        })
        .from(scanCandidates)
        .where(eq(scanCandidates.deliveredRunId, runId))
      const [confirmed] = run.targetCount
        ? await tx
            .select({ at: scanCandidates.readyForReviewAt })
            .from(scanCandidates)
            .where(
              sql`${scanCandidates.deliveredRunId} = ${runId} and ${scanCandidates.readyForReviewAt} is not null and (${scanCandidates.rejectionReason} is null or ${scanCandidates.rejectionReason} not in ${rejectionReasons.filter(isAdmissionRejection)})`,
            )
            .orderBy(
              asc(scanCandidates.readyForReviewAt),
              asc(scanCandidates.id),
            )
            .offset(run.targetCount - 1)
            .limit(1)
        : []
      const sources = await tx
        .select({ source: scanRunSources, label: scanSources.label })
        .from(scanRunSources)
        .innerJoin(scanSources, eq(scanSources.key, scanRunSources.sourceKey))
        .where(eq(scanRunSources.runId, runId))
        .orderBy(asc(scanRunSources.sourceKey))
        .then((rows) =>
          rows.map(({ source, label }) => ({ ...source, label })),
        )
      // Rapprochements ouverts ou décidés sur les dossiers livrés par ce passage.
      const [duplicates] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(scanReviews)
        .innerJoin(
          scanCandidates,
          eq(scanCandidates.id, scanReviews.candidateId),
        )
        .where(
          sql`${scanReviews.kind} = 'duplicate' and ${scanCandidates.deliveredRunId} = ${runId}`,
        )
      return {
        duplicates: duplicates.count,
        run,
        byStatus,
        exclusions,
        rejections,
        sources,
        deliveredBeforeDeadline: run.deadlineAt
          ? delivery.beforeDeadline
          : null,
        targetReachedAt: run.targetReachedAt,
        confirmedTargetReachedAt: confirmed?.at ?? null,
        firstDeliveredAt: run.firstDeliveredAt,
        firstDeliveryDelayMs: run.firstDeliveredAt
          ? run.firstDeliveredAt.getTime() - run.startedAt.getTime()
          : null,
        publications: {
          human: delivery.humanPublications,
          automatic: delivery.automaticPublications,
        },
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  )
}
