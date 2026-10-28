import { getWorkflowMetadata, sleep } from "workflow"

import {
  claimRunStep,
  finishRunStep,
  listPageStep,
  processBatchStep,
} from "./scan-steps"

// Passage du scan (plan scan 09) : remplissage initial ou passage quotidien. Le corps ne fait
// qu'orchestrer, sans réseau ni base. Fermer l'écran de l'admin n'arrête rien.
export async function scanWorkflow(runId: string, token: string) {
  "use workflow"
  const { workflowRunId } = getWorkflowMetadata()
  const claim = await claimRunStep(runId, token, workflowRunId)
  if (!claim.ok) return { runId, outcome: claim.reason }
  // Trois domaines à la fois au plus ; une requête à la fois par domaine.
  for (const wave of claim.waves) {
    const results = await Promise.all(
      wave.map((domain) => scanDomain(runId, token, domain.sources)),
    )
    if (results.includes("superseded")) return { runId, outcome: "superseded" }
  }
  const finished = await finishRunStep(runId, token)
  return finished.ok
    ? { runId, outcome: finished.status }
    : { runId, outcome: finished.reason }
}

// Sources d'un même domaine, l'une après l'autre : la liste, puis les fiches par lots bornés.
// Une source bloquée ou indisponible s'arrête seule ; un arrêt demandé arrête le domaine.
async function scanDomain(runId: string, token: string, sources: string[]) {
  for (const key of sources) {
    for (;;) {
      const page = await listPageStep(runId, token, key)
      if (page.retryAfterMs) {
        await sleep(page.retryAfterMs)
        continue
      }
      if (page.stop === "superseded" || page.stop === "stop_requested")
        return page.stop
      if (page.stop || !page.next) break
    }
    for (;;) {
      const batch = await processBatchStep(runId, token, key)
      if (batch.retryAfterMs) {
        await sleep(batch.retryAfterMs)
        continue
      }
      if (batch.stop === "superseded" || batch.stop === "stop_requested")
        return batch.stop
      if (batch.stop || batch.done) break
    }
  }
  return "done"
}
