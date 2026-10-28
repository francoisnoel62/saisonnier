import { scanLimits } from "./limits"
import type {
  ScanMode,
  ScanSourceKind,
  ScanSourceStatus,
  ScanSourceSwitch,
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
