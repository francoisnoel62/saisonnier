import { assertIsoDate } from "./offer-activity"

// Séries quotidiennes du tableau de bord de l'admin (plan 15) : un point par jour, à Paris.

const DAY_MS = 24 * 60 * 60 * 1000

// Les `days` derniers jours, aujourd'hui compris, du plus ancien au plus récent (AAAA-MM-JJ).
export function lastDays(today: string, days: number) {
  assertIsoDate(today)
  const end = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  )
}

export type DailyCount = { day: string; value: number }

// Un point par jour pour chaque série ; un jour sans événement vaut 0.
export function dailySeries<Key extends string>(
  days: readonly string[],
  series: Record<Key, readonly DailyCount[]>,
) {
  const keys = Object.keys(series) as Key[]
  const byKey = new Map(
    keys.map((key) => [
      key,
      new Map(series[key].map(({ day, value }) => [day, value])),
    ]),
  )
  return days.map(
    (date) =>
      ({
        date,
        ...Object.fromEntries(
          keys.map((key) => [key, byKey.get(key)?.get(date) ?? 0]),
        ),
      }) as { date: string } & Record<Key, number>,
  )
}
