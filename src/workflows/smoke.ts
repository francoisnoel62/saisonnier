import { sleep } from "workflow"

import { smokeDatabaseStep, smokeFinishStep } from "./smoke-steps"

// Diagnostic de l'installation (plan scan 09) : deux étapes séparées par une attente durable.
// Lancé depuis /admin/scan (« Tester l'orchestration »), il ne lit aucune source.
export async function scanSmokeWorkflow(requestedAt: string) {
  "use workflow"
  const database = await smokeDatabaseStep()
  await sleep("5s")
  const finishedAt = await smokeFinishStep()
  return { requestedAt, database, finishedAt }
}
