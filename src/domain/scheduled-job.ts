// Tâches planifiées (plan 16). Chacune a une route appelée par Vercel Cron (vercel.json) et une
// ligne dans la table scheduled_jobs ; le fondateur les active ou les désactive depuis son tableau
// de bord, sans redéploiement. Une nouvelle tâche s'ajoute à ce registre, à vercel.json, et a sa
// route, qui l'exécute par runScheduledJob (src/server/jobs/run.ts).

// Résumé d'un passage de la tâche quotidienne : renvoyé par sa route, conservé en base.
export type DailyJobSummary = {
  // Jour du passage à Paris (AAAA-MM-JJ).
  date: string
  expired: number
  reminders: { sent: number; failed: number }
}

// Résumé d'un déclenchement du scan quotidien (plan scan 09).
export const scanJobOutcomes = [
  "started",
  "already_started",
  "run_in_progress",
  "resumed",
  "start_failed",
  "no_source",
] as const
export type ScanJobOutcome = (typeof scanJobOutcomes)[number]
export type ScanJobSummary = {
  date: string
  outcome: ScanJobOutcome
  runId: string | null
}
const scanJobOutcomeLabels: Record<ScanJobOutcome, string> = {
  started: "passage démarré",
  already_started: "passage du jour déjà lancé",
  run_in_progress: "un autre passage était en cours : rien n'a démarré",
  resumed: "passage du jour relancé",
  start_failed: "démarrage impossible : passage à relancer depuis le scan",
  no_source: "aucune source en passages quotidiens",
}
export function scanJobSummaryLabel({ outcome }: ScanJobSummary) {
  const label = scanJobOutcomeLabels[outcome]
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Résumé d'un passage, par tâche.
export type ScheduledJobSummaries = {
  daily: DailyJobSummary
  scan: ScanJobSummary
}

export type ScheduledJobName = keyof ScheduledJobSummaries

const count = (value: number, one: string, many: string) =>
  `${value} ${value > 1 ? many : one}`

// « 2 annonces expirées, 1 rappel envoyé », pour le tableau de bord de l'admin.
export function dailyJobSummaryLabel({ expired, reminders }: DailyJobSummary) {
  const parts = [
    count(expired, "annonce expirée", "annonces expirées"),
    count(
      reminders.sent,
      "rappel de validité envoyé",
      "rappels de validité envoyés",
    ),
  ]
  if (reminders.failed > 0) {
    parts.push(count(reminders.failed, "envoi en échec", "envois en échec"))
  }
  return parts.join(", ")
}

type ScheduledJobDefinition<Summary> = {
  // Nom montré à l'admin, et libellé de son interrupteur (« … activée »).
  label: string
  description: string
  // Horaire de vercel.json, en clair. Vercel Cron compte en UTC.
  schedule: string
  // État d'une tâche sans ligne en base (active par défaut).
  enabledByDefault?: boolean
  summaryLabel: (summary: Summary) => string
}

export const scheduledJobDefinitions: {
  [Name in ScheduledJobName]: ScheduledJobDefinition<
    ScheduledJobSummaries[Name]
  >
} = {
  daily: {
    label: "Tâche quotidienne",
    description:
      "Les annonces dont l'échéance est passée deviennent « expirées », et les déposants reçoivent le rappel de validité à 30 jours. Sans réponse, une annonce reste en ligne.",
    schedule: "Chaque nuit à 3 h UTC (4 h ou 5 h à Paris selon l'heure d'été)",
    summaryLabel: dailyJobSummaryLabel,
  },
  scan: {
    label: "Scan quotidien des offres",
    description:
      "Chaque nuit, le scan relit les sources activées pour les passages quotidiens, sur les 72 dernières heures, et livre les nouveaux dossiers à vérifier. Désactivé tant que le remplissage initial n'est pas terminé.",
    schedule: "Chaque nuit vers 3 h, heure de Paris",
    enabledByDefault: false,
    summaryLabel: scanJobSummaryLabel,
  },
}

export function jobEnabledByDefault(name: ScheduledJobName) {
  return scheduledJobDefinitions[name].enabledByDefault ?? true
}

export const scheduledJobNames = Object.keys(
  scheduledJobDefinitions,
) as ScheduledJobName[]

export function isScheduledJobName(value: unknown): value is ScheduledJobName {
  return (
    typeof value === "string" && (scheduledJobNames as string[]).includes(value)
  )
}

// Résumé d'un passage conservé en base (jsonb), pour l'admin.
export function scheduledJobSummaryLabel<Name extends ScheduledJobName>(
  name: Name,
  summary: ScheduledJobSummaries[Name],
) {
  return scheduledJobDefinitions[name].summaryLabel(summary)
}
