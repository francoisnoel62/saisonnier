import { scanLimits } from "./limits"
import {
  scanSourceStatusLabels,
  type ScanMode,
  type ScanSourceKind,
  type ScanSourceStatus,
  type ScanSourceSwitch,
} from "./vocabulary"

// D11 : trois interrupteurs stockés séparément ; l'effet est leur conjonction.
export type SourceSwitchState = {
  status: ScanSourceStatus
  kind: ScanSourceKind
  enabled: boolean
  dailyEnabled: boolean
  autoPublish: boolean
  suspendedAt: Date | string | null
  scheduledAccessBasis: string | null
}
export type SourceEffectContext = { adapterAvailable: boolean }

// Lue par un passage de ce mode : relu avant chaque lot (SH22).
export function sourceParticipates(
  source: SourceSwitchState,
  mode: ScanMode,
  { adapterAvailable }: SourceEffectContext,
) {
  return (
    source.status === "ready" &&
    source.enabled &&
    !source.suspendedAt &&
    adapterAvailable &&
    (mode === "bootstrap" || source.dailyEnabled)
  )
}

// Seul un portail employeur publie sans revue, et seulement en passage quotidien (SH24).
export function sourceAutoPublishes(
  source: SourceSwitchState,
  context: SourceEffectContext,
) {
  return (
    source.kind === "employer" &&
    source.autoPublish &&
    sourceParticipates(source, "daily", context)
  )
}

export const switchBlockerCodes = [
  "not_ready",
  "adapter_unavailable",
  "suspended",
  "max_enabled",
  "discovery_auto_publish",
  "scheduled_access_missing",
] as const
export type SwitchBlocker = (typeof switchBlockerCodes)[number]
export const switchBlockerLabels: Record<SwitchBlocker, string> = {
  not_ready: "À qualifier : la source n’est pas prête.",
  adapter_unavailable: "Connecteur indisponible sur ce déploiement.",
  suspended:
    "Source suspendue : un test réussi est nécessaire avant de la reprendre.",
  max_enabled: `${scanLimits.maxEnabledSources} sources activées au plus.`,
  discovery_auto_publish:
    "Une source de découverte ne publie jamais automatiquement.",
  scheduled_access_missing:
    "Découverte : justification d’accès programmé à renseigner avant les passages quotidiens.",
}
export type SwitchContext = SourceEffectContext & {
  // Sources activées, celle-ci exceptée.
  enabledCount: number
}

// Portes d'un interrupteur (§10.2). Désactiver est toujours possible.
export function switchBlockers(
  source: SourceSwitchState,
  flag: ScanSourceSwitch,
  value: boolean,
  context: SwitchContext,
): SwitchBlocker[] {
  if (!value) return []
  const blockers: SwitchBlocker[] = []
  if (source.status !== "ready") blockers.push("not_ready")
  if (flag === "enabled") {
    if (!context.adapterAvailable) blockers.push("adapter_unavailable")
    if (source.suspendedAt) blockers.push("suspended")
    if (context.enabledCount >= scanLimits.maxEnabledSources)
      blockers.push("max_enabled")
  }
  if (
    flag === "dailyEnabled" &&
    source.kind === "discovery" &&
    !source.scheduledAccessBasis
  )
    blockers.push("scheduled_access_missing")
  if (flag === "autoPublish" && source.kind === "discovery")
    blockers.push("discovery_auto_publish")
  return blockers
}

// Message affiché sous un interrupteur désactivé (aria-describedby).
export function switchBlockerMessage(
  blocker: SwitchBlocker,
  source: Pick<SourceSwitchState, "status">,
) {
  if (blocker === "not_ready" && source.status === "rejected")
    return "Source écartée : réexaminez-la avant toute activation."
  if (blocker === "not_ready" && source.status === "archived")
    return "Source archivée : restaurez-la avant toute activation."
  return switchBlockerLabels[blocker]
}

// Cycle de vie (§10.1). « Activée » n'est pas un statut : c'est un interrupteur d'une source prête.
export const sourceTransitions = [
  "mark_ready",
  "back_to_draft",
  "reject",
  "reexamine",
  "archive",
  "restore",
] as const
export type SourceTransition = (typeof sourceTransitions)[number]
export const sourceTransitionLabels: Record<SourceTransition, string> = {
  mark_ready: "Marquer prête",
  back_to_draft: "Repasser en brouillon",
  reject: "Écarter",
  reexamine: "Réexaminer",
  archive: "Archiver",
  restore: "Restaurer",
}
export const sourceTransitionMoves: Record<
  SourceTransition,
  { from: readonly ScanSourceStatus[]; to: ScanSourceStatus }
> = {
  mark_ready: { from: ["draft"], to: "ready" },
  back_to_draft: { from: ["ready"], to: "draft" },
  reject: { from: ["draft", "ready"], to: "rejected" },
  reexamine: { from: ["rejected"], to: "draft" },
  archive: { from: ["draft", "ready", "rejected"], to: "archived" },
  restore: { from: ["archived"], to: "draft" },
}
export const rejectionReasonBounds = { min: 10, max: 500 } as const

export type TransitionBlocker =
  "wrong_status" | "reason_required" | "qualification"
// Conditions propres à la transition ; la qualification et les hôtes sont vérifiés par le
// service, dans la transaction.
export function transitionBlockers(
  status: ScanSourceStatus,
  transition: SourceTransition,
  { reason }: { reason?: string } = {},
): TransitionBlocker[] {
  const blockers: TransitionBlocker[] = []
  if (!sourceTransitionMoves[transition].from.includes(status))
    blockers.push("wrong_status")
  if (transition === "reject") {
    const length = reason?.trim().length ?? 0
    if (
      length < rejectionReasonBounds.min ||
      length > rejectionReasonBounds.max
    )
      blockers.push("reason_required")
  }
  return blockers
}
export function transitionBlockerMessage(
  blocker: TransitionBlocker,
  transition: SourceTransition,
  status: ScanSourceStatus,
) {
  if (blocker === "reason_required")
    return `Motif de ${rejectionReasonBounds.min} à ${rejectionReasonBounds.max} caractères.`
  if (blocker === "qualification")
    return "Qualification incomplète : voir l’onglet Qualification."
  return `${sourceTransitionLabels[transition]} : impossible depuis le statut « ${scanSourceStatusLabels[status]} ».`
}

// Ordre des sources : priorité puis libellé ; monter ou descendre échange deux voisines.
export function moveInOrder<T>(
  items: readonly T[],
  index: number,
  offset: -1 | 1,
) {
  const target = index + offset
  if (index < 0 || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// Onglets de la liste (§11.2) ; « Toutes » laisse de côté les sources archivées.
export const sourceListFilters = [
  "toutes",
  "actives",
  "pretes",
  "brouillons",
  "ecartees",
  "archivees",
] as const
export type SourceListFilter = (typeof sourceListFilters)[number]
export const sourceListFilterLabels: Record<SourceListFilter, string> = {
  toutes: "Toutes",
  actives: "Actives",
  pretes: "Prêtes",
  brouillons: "Brouillons",
  ecartees: "Écartées",
  archivees: "Archivées",
}
