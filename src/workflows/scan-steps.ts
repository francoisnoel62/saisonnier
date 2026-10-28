import {
  claimScanRun,
  finishScanRun,
  listSourcePage,
  processSourceBatch,
} from "@/server/scan/orchestration"

// Étapes durables du scan (plan scan 09) : identifiants et compteurs en entrée et en sortie,
// jamais le contenu d'une page. Le travail est dans src/server/scan/orchestration.ts.

export async function claimRunStep(
  runId: string,
  token: string,
  workflowRunId: string,
) {
  "use step"
  return claimScanRun(runId, token, workflowRunId)
}

export async function listPageStep(runId: string, token: string, key: string) {
  "use step"
  return listSourcePage(runId, token, key)
}

export async function processBatchStep(
  runId: string,
  token: string,
  key: string,
) {
  "use step"
  return processSourceBatch(runId, token, key)
}

export async function finishRunStep(runId: string, token: string) {
  "use step"
  return finishScanRun(runId, token)
}
