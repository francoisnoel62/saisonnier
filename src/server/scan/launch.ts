import "server-only"

import { and, eq, isNull } from "drizzle-orm"
import { getRun, start } from "workflow/api"

import type { ScanJobSummary } from "@/domain/scheduled-job"
import { todayInParis } from "@/domain/offer-activity"
import {
  isResumableStatus,
  orchestrationLost,
  unstartedRunGraceMs,
  type WorkflowStatus,
} from "@/domain/scan/orchestration"
import { activeRunStatuses } from "@/domain/scan/run"
import { db } from "@/lib/db"
import { scanRuns, type ScanRun } from "@/lib/db/schema"
import { scanWorkflow } from "@/workflows/scan"

import { getActiveRun } from "./queries"
import {
  createBootstrapRun,
  createDailyRun,
  renewClaim,
  requestStop,
} from "./runs"
import { listRunnableSources } from "./sources/registry"

// Déclenchement des passages (plan scan 09) : l'admin lance, reprend ou arrête ; le cron démarre le
// passage du jour. Le démarrage du workflow est injectable pour les tests d'intégration.

export type Orchestrator = {
  start: (runId: string, token: string) => Promise<{ runId: string }>
  status: (workflowRunId: string) => Promise<WorkflowStatus | null>
}

export const workflowOrchestrator: Orchestrator = {
  start: (runId, token) => start(scanWorkflow, [runId, token]),
  async status(workflowRunId) {
    try {
      const run = getRun(workflowRunId)
      return (await run.exists) ? await run.status : null
    } catch {
      return null
    }
  },
}

export type LaunchResult =
  | { ok: true; runId: string }
  | {
      ok: false
      reason:
        | "no_source"
        | "run_in_progress"
        | "already_exists"
        | "start_failed"
        | "not_found"
        | "not_resumable"
        | "orchestration_active"
      runId?: string
    }

// `start` répond dès que le run est pris en charge : l'admin reçoit l'identifiant du passage sans
// attendre la collecte. Un échec laisse le passage « en attente », à relancer.
async function orchestrate(
  run: ScanRun,
  orchestrator: Orchestrator,
): Promise<LaunchResult> {
  try {
    const workflow = await orchestrator.start(run.id, run.claimToken)
    await db
      .update(scanRuns)
      .set({ workflowRunId: workflow.runId })
      .where(
        and(
          eq(scanRuns.id, run.id),
          eq(scanRuns.claimToken, run.claimToken),
          isNull(scanRuns.workflowRunId),
        ),
      )
    console.info(
      `[scan passage] workflow démarré ${run.id} → ${workflow.runId}`,
    )
    return { ok: true, runId: run.id }
  } catch (error) {
    console.error(`[scan passage] démarrage impossible ${run.id}`, error)
    return { ok: false, reason: "start_failed", runId: run.id }
  }
}

export async function launchBootstrap(
  userId: string,
  {
    now = new Date(),
    orchestrator = workflowOrchestrator,
  }: { now?: Date; orchestrator?: Orchestrator } = {},
): Promise<LaunchResult> {
  if (!(await listRunnableSources("bootstrap")).length)
    return { ok: false, reason: "no_source" }
  const created = await createBootstrapRun({ requestedBy: userId, now })
  if (!("run" in created)) return { ok: false, reason: "run_in_progress" }
  // SH3 : un seul remplissage initial ; l'existant se reprend, il ne se recrée pas.
  if (!created.created)
    return { ok: false, reason: "already_exists", runId: created.run.id }
  return orchestrate(created.run, orchestrator)
}

// « Reprendre » : passage arrêté, partiel ou en échec ; ou passage actif dont l'orchestration est
// perdue. Nouveau jeton : l'ancien run, s'il vit encore, n'écrit plus rien.
export async function resumeRun(
  runId: string,
  {
    now = new Date(),
    orchestrator = workflowOrchestrator,
    unstartedMs = unstartedRunGraceMs.admin,
  }: { now?: Date; orchestrator?: Orchestrator; unstartedMs?: number } = {},
): Promise<LaunchResult> {
  const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, runId))
  if (!run) return { ok: false, reason: "not_found" }
  let renewed
  if (isResumableStatus(run.status)) renewed = await renewClaim(runId, now)
  else if (activeRunStatuses.some((status) => status === run.status)) {
    const workflowStatus = run.workflowRunId
      ? await orchestrator.status(run.workflowRunId)
      : null
    if (!orchestrationLost(run, workflowStatus, now, { unstartedMs }))
      return { ok: false, reason: "orchestration_active", runId }
    renewed = await renewClaim(runId, now, { lostClaimToken: run.claimToken })
  } else return { ok: false, reason: "not_resumable", runId }
  if (!renewed.ok)
    return {
      ok: false,
      reason:
        renewed.reason === "run_in_progress"
          ? "run_in_progress"
          : renewed.reason === "orchestration_not_lost"
            ? "orchestration_active"
            : "not_resumable",
      runId,
    }
  return orchestrate(renewed.run, orchestrator)
}

export async function stopRun(runId: string, now = new Date()) {
  return requestStop(runId, now)
}

// Cron quotidien (après la garde de créneau) : un passage par jour de Paris (SH2, SH11).
export async function startDailyScan(
  now: Date,
  { orchestrator = workflowOrchestrator }: { orchestrator?: Orchestrator } = {},
): Promise<ScanJobSummary> {
  const date = todayInParis(now)
  if (!(await listRunnableSources("daily")).length)
    return { date, outcome: "no_source", runId: null }
  const active = await getActiveRun()
  if (active && active.runKey !== `daily:${date}`)
    return { date, outcome: "run_in_progress", runId: active.id }
  const created = await createDailyRun({ date, now, trigger: "cron" })
  if (!("run" in created))
    return { date, outcome: "run_in_progress", runId: null }
  if (!created.created) {
    const existing = created.run
    // Passage du jour créé sans workflow (démarrage échoué) : relancé après dix minutes.
    if (existing.status === "queued" && !existing.workflowRunId) {
      const resumed = await resumeRun(existing.id, {
        now,
        orchestrator,
        unstartedMs: unstartedRunGraceMs.cron,
      })
      if (resumed.ok) return { date, outcome: "resumed", runId: existing.id }
      if (resumed.reason === "start_failed")
        return { date, outcome: "start_failed", runId: existing.id }
    }
    return { date, outcome: "already_started", runId: existing.id }
  }
  const started = await orchestrate(created.run, orchestrator)
  return {
    date,
    outcome: started.ok ? "started" : "start_failed",
    runId: created.run.id,
  }
}
