// Tâches planifiées (plan 16). Vercel Cron appelle chaque nuit la route de la tâche quotidienne ;
// le fondateur l'active ou la désactive depuis son tableau de bord, sans redéploiement.

export const scheduledJobNames = ["daily"] as const
export type ScheduledJobName = (typeof scheduledJobNames)[number]

// Résumé d'un passage de la tâche quotidienne, renvoyé par la route et conservé en base.
export type DailyJobSummary = {
  // Jour du passage à Paris (AAAA-MM-JJ).
  date: string
  expired: number
  reminders: { sent: number; failed: number }
}

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
