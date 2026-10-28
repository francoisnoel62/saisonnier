import { scanLimits } from "./limits"
import type { ScanMode, ScanRunSourceStatus } from "./vocabulary"

// Couverture des employeurs d'une source de découverte (lot F, SH31) : la découverte sert de
// radar ; chaque employeur révélé devient une source employeur, ou une piste « à inviter ».
// Au-delà de 75 % sur deux périodes de 30 jours de suite, l'écran propose de passer la
// découverte en réserve, sans rien changer seul.
export type CoverageDossier = {
  // Décision, sinon livraison du dossier.
  at: Date | string
  employerKey: string | null
  // Hôte de l'URL officielle établie de l'employeur.
  officialHost: string | null
  // Entreprise choisie pour le dossier.
  companyId: string | null
}
export type CoverageContext = {
  // Hôtes des sources employeur non archivées (scan_source_hosts).
  coveredHosts: ReadonlySet<string>
  // Entreprises reliées à une source employeur non archivée.
  coveredCompanyIds: ReadonlySet<string>
  // Pistes ouvertes ou décidées « invité ».
  leadKeys: ReadonlySet<string>
  today: Date
}
export type CoverageClass = "covered" | "to_invite" | "unknown"
export type CoverageCounts = {
  covered: number
  toInvite: number
  unknown: number
  total: number
  // Part des employeurs couverts, nulle sans dossier.
  rate: number | null
}

const day = 24 * 60 * 60 * 1_000

export function classifyDossier(
  dossier: CoverageDossier,
  context: CoverageContext,
): CoverageClass {
  if (
    (dossier.officialHost && context.coveredHosts.has(dossier.officialHost)) ||
    (dossier.companyId && context.coveredCompanyIds.has(dossier.companyId))
  )
    return "covered"
  if (dossier.employerKey && context.leadKeys.has(dossier.employerKey))
    return "to_invite"
  return "unknown"
}

function counts(classes: CoverageClass[]): CoverageCounts {
  const covered = classes.filter((item) => item === "covered").length
  const toInvite = classes.filter((item) => item === "to_invite").length
  const total = classes.length
  return {
    covered,
    toInvite,
    unknown: total - covered - toInvite,
    total,
    rate: total ? covered / total : null,
  }
}
function between(dossier: CoverageDossier, from: number, to: number) {
  const at = new Date(dossier.at).getTime()
  return at > from && at <= to
}

export function discoveryCoverage(
  dossiers: readonly CoverageDossier[],
  context: CoverageContext,
) {
  const now = context.today.getTime()
  const classify = (from: number, to: number) =>
    counts(
      dossiers
        .filter((dossier) => between(dossier, from, to))
        .map((dossier) => classifyDossier(dossier, context)),
    )
  const last30 = classify(now - 30 * day, now)
  const previous30 = classify(now - 60 * day, now - 30 * day)
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const end = now - (11 - index) * 7 * day
    return {
      start: new Date(end - 7 * day).toISOString().slice(0, 10),
      ...classify(end - 7 * day, end),
    }
  })
  const target = scanLimits.discoveryCoverageTarget
  return {
    last30,
    previous30,
    weeks,
    suggestReserve:
      last30.rate !== null &&
      previous30.rate !== null &&
      last30.rate >= target &&
      previous30.rate >= target,
  }
}
export type DiscoveryCoverage = ReturnType<typeof discoveryCoverage>

export function formatCoverage(coverage: CoverageCounts) {
  return coverage.rate === null
    ? "Aucun dossier sur la période."
    : `Couverture des employeurs : ${Math.round(coverage.rate * 100)} % (${coverage.covered} couvert${coverage.covered > 1 ? "s" : ""} · ${coverage.toInvite} à inviter · ${coverage.unknown} inconnu${coverage.unknown > 1 ? "s" : ""})`
}

// Santé d'une source (lot E) d'après ses derniers passages, du plus récent au plus ancien.
export type RunSourceOutcome = {
  status: ScanRunSourceStatus
  mode: ScanMode
  failedCount: number
  robotsDigest: string | null
}
export const sourceHealthStates = [
  "healthy",
  "degraded",
  "blocked",
  "suspended",
  "unknown",
] as const
export type SourceHealth = (typeof sourceHealthStates)[number]
export const sourceHealthLabels: Record<SourceHealth, string> = {
  healthy: "Saine",
  degraded: "Dégradée",
  blocked: "Bloquée",
  suspended: "Suspendue",
  unknown: "Aucun passage",
}
const finished: readonly ScanRunSourceStatus[] = ["done", "failed", "blocked"]

export function sourceHealth(
  runs: readonly RunSourceOutcome[],
  { suspended }: { suspended: boolean },
): SourceHealth {
  if (suspended) return "suspended"
  const [last] = runs.filter((run) => finished.includes(run.status))
  if (!last) return "unknown"
  if (last.status === "blocked") return "blocked"
  if (last.status === "failed" || last.failedCount > 0) return "degraded"
  return "healthy"
}

// D9 : trois passages consécutifs où la source est bloquée (robots.txt, 401, 403) la suspendent.
// Une indisponibilité (5xx, délai) n'est qu'un signal de santé.
export function shouldSuspendSource(lastRuns: readonly RunSourceOutcome[]) {
  const recent = lastRuns
    .filter((run) => finished.includes(run.status))
    .slice(0, scanLimits.suspendAfterBlockedRuns)
  return (
    recent.length === scanLimits.suspendAfterBlockedRuns &&
    recent.every((run) => run.status === "blocked")
  )
}

// Publication automatique : alerte tant que trois passages quotidiens terminés sans échec
// d'extraction ne sont pas atteints (recommandation du plan scan 10).
export function autoPublishReadiness(runs: readonly RunSourceOutcome[]) {
  const clean = runs.filter(
    (run) =>
      run.mode === "daily" && run.status === "done" && run.failedCount === 0,
  ).length
  return { ready: clean >= 3, clean, needed: 3 }
}

// Qualification à revérifier tous les 180 jours (alerte, sans désactivation).
export function qualificationDue(checkedAt: string | null, today: Date) {
  if (!checkedAt) return true
  return (
    today.getTime() - new Date(`${checkedAt}T00:00:00Z`).getTime() >
    scanLimits.qualificationMaxAgeDays * day
  )
}

// robots.txt a changé entre les deux derniers passages qui l'ont lu.
export function robotsChanged(runs: readonly RunSourceOutcome[]) {
  const digests = runs
    .map((run) => run.robotsDigest)
    .filter((digest): digest is string => !!digest)
  return digests.length >= 2 && digests[0] !== digests[1]
}
