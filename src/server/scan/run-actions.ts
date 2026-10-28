"use server"

import { revalidatePath } from "next/cache"
import { getRun, start } from "workflow/api"
import { z } from "zod"

import { requireRole } from "@/lib/dal"
import { scanSmokeWorkflow } from "@/workflows/smoke"

import {
  launchBootstrap,
  resumeRun,
  stopRun,
  type LaunchResult,
} from "./launch"

const launchMessages: Record<
  Extract<LaunchResult, { ok: false }>["reason"],
  string
> = {
  no_source:
    "Aucune source activée pour le remplissage initial : activez-en une depuis les sources du scan.",
  run_in_progress: "Un autre passage est en cours : attendez sa fin.",
  already_exists:
    "Le remplissage initial a déjà été lancé : ouvrez-le pour le suivre ou le reprendre.",
  start_failed:
    "Le passage est créé, mais son exécution n’a pas démarré : utilisez « Relancer ».",
  not_found: "Passage introuvable.",
  not_resumable: "Ce passage est terminé : il ne se reprend pas.",
  orchestration_active:
    "Ce passage progresse encore : la reprise n’est possible qu’après son arrêt ou 15 minutes sans progrès.",
}

function launchResponse(result: LaunchResult) {
  revalidatePath("/admin/scan", "layout")
  return result.ok
    ? ({ ok: true, runId: result.runId } as const)
    : ({
        ok: false,
        runId: result.runId ?? null,
        message: launchMessages[result.reason],
      } as const)
}

// Lancement du premier remplissage (SH3) : la réponse arrive dès que le workflow est pris en
// charge, sans attendre la collecte.
export async function launchBootstrapScanAction() {
  const { user } = await requireRole("admin")
  return launchResponse(await launchBootstrap(user.id))
}

export async function resumeScanRunAction(runId: string) {
  await requireRole("admin")
  if (!z.uuid().safeParse(runId).success)
    return { ok: false, runId: null, message: "Passage introuvable." } as const
  return launchResponse(await resumeRun(runId))
}

export async function stopScanRunAction(runId: string) {
  await requireRole("admin")
  if (!z.uuid().safeParse(runId).success)
    return { ok: false, message: "Passage introuvable." } as const
  const stopped = await stopRun(runId)
  revalidatePath("/admin/scan", "layout")
  return stopped
    ? ({ ok: true } as const)
    : ({ ok: false, message: "Ce passage n’est plus en cours." } as const)
}

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
