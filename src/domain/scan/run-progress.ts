// Avancement d'un passage affiché sur /admin/scan (plan scan 09) : échéance, reste à livrer,
// seuil atteint à T+…

// « 2 h 05 », « 12 min », « moins d'une minute ».
export function formatDuration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return "moins d’une minute"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`
}

export function runProgress(
  run: {
    startedAt: string
    deadlineAt: string | null
    deliveredCount: number
    targetCount: number | null
    targetReachedAt: string | null
    firstDeliveredAt: string | null
  },
  now: Date,
) {
  const startedAt = Date.parse(run.startedAt)
  return {
    remainingMs: run.deadlineAt
      ? Math.max(0, Date.parse(run.deadlineAt) - now.getTime())
      : null,
    toDeliver:
      run.targetCount !== null
        ? Math.max(0, run.targetCount - run.deliveredCount)
        : null,
    reachedAfterMs: run.targetReachedAt
      ? Date.parse(run.targetReachedAt) - startedAt
      : null,
    firstDeliveryAfterMs: run.firstDeliveredAt
      ? Date.parse(run.firstDeliveredAt) - startedAt
      : null,
  }
}
