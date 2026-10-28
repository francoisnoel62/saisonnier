import { scanLimits } from "./limits"
import { activeRunStatuses } from "./run"
import type { ScanRunStatus } from "./vocabulary"

// Règles de l'orchestration du scan (plan scan 09) : aucune lecture réseau ni base.

export type DomainPlan = { host: string; sources: string[] }

// Sources regroupées par hôte de leur première liste (une requête à la fois par domaine), dans
// l'ordre reçu (priorité du registre), puis par vagues de trois domaines au plus.
export function planDomains(
  sources: readonly { key: string; host: string }[],
  concurrency: number = scanLimits.concurrentHosts,
): DomainPlan[][] {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError("Nombre de domaines simultanés invalide")
  const domains: DomainPlan[] = []
  for (const source of sources) {
    const host = source.host.toLowerCase()
    const domain = domains.find((plan) => plan.host === host)
    if (domain) {
      if (!domain.sources.includes(source.key)) domain.sources.push(source.key)
    } else domains.push({ host, sources: [source.key] })
  }
  const waves: DomainPlan[][] = []
  for (let i = 0; i < domains.length; i += concurrency)
    waves.push(domains.slice(i, i + concurrency))
  return waves
}

// Réserve gardée à la fin d'un lot pour une dernière fiche : un échange (15 s), l'intervalle de
// politesse et la résolution des lieux.
export const postingReserveMs = 30_000

// Une nouvelle fiche ne commence que si elle peut finir dans le budget de l'étape (120 s).
export function canStartPosting(
  startedAt: number,
  now: number,
  budgetMs: number = scanLimits.batchBudgetMs,
) {
  return now - startedAt + postingReserveMs <= budgetMs
}

// Sans progrès pendant 15 minutes, ou workflow terminé alors que le passage est actif : son
// orchestration est perdue, « Reprendre » renouvelle le jeton.
export const orchestrationStallMs = 15 * 60 * 1_000
// Passage créé sans workflow : l'admin peut relancer après une minute ; le cron, après dix.
export const unstartedRunGraceMs = { admin: 60 * 1_000, cron: 10 * 60 * 1_000 }

export type WorkflowStatus =
  "pending" | "running" | "completed" | "failed" | "cancelled"

export function orchestrationLost(
  run: {
    status: ScanRunStatus
    workflowRunId: string | null
    lastProgressAt: Date | null
    startedAt: Date
  },
  workflowStatus: WorkflowStatus | null,
  now: Date,
  { unstartedMs = unstartedRunGraceMs.admin }: { unstartedMs?: number } = {},
) {
  if (!activeRunStatuses.some((status) => status === run.status)) return false
  const idleMs = now.getTime() - (run.lastProgressAt ?? run.startedAt).getTime()
  if (!run.workflowRunId) return idleMs > unstartedMs
  if (
    workflowStatus === null ||
    workflowStatus === "completed" ||
    workflowStatus === "failed" ||
    workflowStatus === "cancelled"
  )
    return true
  return idleMs > orchestrationStallMs
}

// Passages que « Reprendre » relance sans attendre : terminés sans être complets.
export const resumableRunStatuses = ["stopped", "partial", "failed"] as const
export function isResumableStatus(status: ScanRunStatus) {
  return resumableRunStatuses.some((resumable) => resumable === status)
}
