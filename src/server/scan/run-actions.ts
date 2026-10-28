"use server"

import { getRun, start } from "workflow/api"

import { requireRole } from "@/lib/dal"
import { scanSmokeWorkflow } from "@/workflows/smoke"

// Diagnostic « Tester l'orchestration » (plan scan 09, étape 1) : il démarre un workflow minimal
// et l'écran suit son statut ; aucune source n'est lue.
export async function startOrchestrationTestAction() {
  await requireRole("admin")
  try {
    const run = await start(scanSmokeWorkflow, [new Date().toISOString()])
    console.info(`[scan orchestration] diagnostic démarré ${run.runId}`)
    return { ok: true, runId: run.runId } as const
  } catch (error) {
    console.error("[scan orchestration] démarrage impossible", error)
    return {
      ok: false,
      message: "Le workflow n’a pas pu démarrer : consultez les journaux.",
    } as const
  }
}

export async function orchestrationTestStatusAction(runId: string) {
  await requireRole("admin")
  if (typeof runId !== "string" || !/^wrun_[0-9A-Za-z]+$/.test(runId))
    return { ok: false, message: "Identifiant de run invalide." } as const
  try {
    const run = getRun(runId)
    const status = await run.status
    if (status !== "completed") return { ok: true, status } as const
    const result = await run.returnValue
    return { ok: true, status, result } as const
  } catch (error) {
    console.error(`[scan orchestration] statut illisible ${runId}`, error)
    return { ok: false, message: "Statut du workflow illisible." } as const
  }
}
