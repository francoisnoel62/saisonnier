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

// Résumé d'un passage, par tâche.
export type ScheduledJobSummaries = {
  daily: DailyJobSummary
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
