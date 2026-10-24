import "server-only"

import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"

import { scanLimits } from "@/domain/scan/limits"
import { activeRunStatuses, type TerminalRunStatus } from "@/domain/scan/run"
import { validCivilDate } from "@/domain/scan/source-date"
import type { ScanRunTrigger } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import { scanRuns, type ScanRun } from "@/lib/db/schema"

import { superseded, withRunClaim } from "./claim"

export type CreateRunResult =
  { created: boolean; run: ScanRun } | { ok: false; reason: "run_in_progress" }

async function createRun(
  values: typeof scanRuns.$inferInsert,
): Promise<CreateRunResult> {
  // ON CONFLICT couvre la clé logique et l'index du passage actif sans interrompre la transaction.
  const [created] = await db
    .insert(scanRuns)
    .values(values)
    .onConflictDoNothing()
    .returning()
  if (created) return { created: true, run: created }
  const [existing] = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.runKey, values.runKey))
  return existing
    ? { created: false, run: existing }
    : { ok: false, reason: "run_in_progress" }
}

export function createBootstrapRun({
  requestedBy,
  now,
}: {
  requestedBy: string
  now: Date
}) {
  return createRun({
    mode: "bootstrap",
    runKey: "bootstrap",
    trigger: "admin",
    requestedByUserId: requestedBy,
    claimToken: randomUUID(),
    startedAt: now,
    deadlineAt: new Date(now.getTime() + scanLimits.bootstrapDeadlineMs),
    targetCount: scanLimits.bootstrapTarget,
  })
}

// date est un jour civil de Paris, calculé par l'appelant (cron ou admin).
export function createDailyRun({
  date,
  now,
  trigger,
  requestedBy,
}: {
  date: string
  now: Date
  trigger: ScanRunTrigger
  requestedBy?: string
}) {
  if (!validCivilDate(date)) throw new RangeError("Jour de Paris invalide")
  return createRun({
    mode: "daily",
    runKey: `daily:${date}`,
    trigger,
    requestedByUserId: requestedBy,
    claimToken: randomUUID(),
    startedAt: now,
    windowStart: new Date(now.getTime() - scanLimits.dailyWindowMs),
  })
}

export async function claimRun(
  runId: string,
  token: string,
  workflowRunId: string,
  now: Date,
) {
  const [run] = await db
    .update(scanRuns)
    .set({ status: "running", workflowRunId, lastProgressAt: now })
    .where(
      and(
        eq(scanRuns.id, runId),
        eq(scanRuns.claimToken, token),
        inArray(scanRuns.status, ["queued", "running"]),
      ),
    )
    .returning()
  return run ? ({ ok: true, run } as const) : superseded
}

// Le plan 09 vérifie la perte du Workflow avant de fournir son jeton observé.
// Le CAS empêche deux tentatives de récupération d'invalider le nouveau workflow.
export async function renewClaim(
  runId: string,
  now: Date,
  recovery?: { lostClaimToken: string },
) {
  return db
    .transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(scanRuns)
        .where(eq(scanRuns.id, runId))
        .for("update")
      if (!run || run.status === "completed")
        return { ok: false, reason: "not_resumable" } as const
      const active = activeRunStatuses.some((status) => status === run.status)
      if (active && recovery?.lostClaimToken !== run.claimToken)
        return { ok: false, reason: "orchestration_not_lost" } as const
      // Une reprise ne peut pas prendre la place d'un autre passage actif.
      const [updated] = await tx
        .update(scanRuns)
        .set({
          claimToken: randomUUID(),
          status: "queued",
          stopRequestedAt: null,
          finishedAt: null,
          workflowRunId: null,
          lastProgressAt: now,
        })
        .where(eq(scanRuns.id, runId))
        .returning()
      return { ok: true, run: updated } as const
    })
    .catch((error: unknown) => {
      if (
        (error as { cause?: { constraint?: string } }).cause?.constraint ===
        "scan_runs_single_active"
      )
        return { ok: false, reason: "run_in_progress" } as const
      throw error
    })
}

export async function requestStop(runId: string, now: Date) {
  const [run] = await db
    .update(scanRuns)
    .set({ status: "stopping", stopRequestedAt: now })
    .where(
      and(
        eq(scanRuns.id, runId),
        inArray(scanRuns.status, ["queued", "running"]),
      ),
    )
    .returning()
  return run ?? null
}

export function markProgress(runId: string, token: string, now: Date) {
  return withRunClaim(runId, token, async (tx) => {
    await tx
      .update(scanRuns)
      .set({ lastProgressAt: now })
      .where(eq(scanRuns.id, runId))
    return { ok: true } as const
  })
}

export function finishRun(
  runId: string,
  token: string,
  status: TerminalRunStatus,
  now: Date,
) {
  return withRunClaim(runId, token, async (tx, run) => {
    const [finished] = await tx
      .update(scanRuns)
      .set({
        status: run.stopRequestedAt ? "stopped" : status,
        finishedAt: now,
        lastProgressAt: now,
      })
      .where(eq(scanRuns.id, runId))
      .returning()
    return { ok: true, run: finished } as const
  })
}
