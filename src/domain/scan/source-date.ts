import { fold } from "./text"

export type SourceDate =
  | { precision: "instant"; at: string }
  | { precision: "day"; date: string; timeZone: string }
export const frenchMonths = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
] as const
export function civilDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const at = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(at.getTime()) &&
    at.toISOString().slice(0, 10) === value
    ? value
    : null
}
export function validCivilDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return !!match && civilDate(+match[1], +match[2], +match[3]) === value
}
export function addDays(date: string, count: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + count * 86_400_000)
    .toISOString()
    .slice(0, 10)
}
export function dateInZone(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at)
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`
}
// Recherche des bornes civiles : un jour peut durer 23 h, 24 h ou 25 h.
export function zonedDayRange(
  date: string,
  timeZone: string,
): { start: number; end: number } | null {
  if (!validCivilDate(date)) return null
  try {
    const boundary = (target: string) => {
      const utc = Date.parse(`${target}T00:00:00Z`)
      let low = utc - 36 * 3_600_000,
        high = utc + 36 * 3_600_000
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (dateInZone(middle, timeZone) < target) low = middle + 1
        else high = middle
      }
      return low
    }
    const start = boundary(date),
      end = boundary(addDays(date, 1))
    return start < end && dateInZone(start, timeZone) === date
      ? { start, end }
      : null
  } catch {
    return null
  }
}
export function parseSourceDate(
  raw: string,
  { timeZone = "Europe/Paris" }: { timeZone?: string } = {},
): SourceDate | null {
  const text = fold(raw.trim())
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const french = /^(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})$/.exec(text)
  if (day || french) {
    const date = day
      ? civilDate(+day[1], +day[2], +day[3])
      : civilDate(
          +french![3],
          frenchMonths.indexOf(french![2] as (typeof frenchMonths)[number]) + 1,
          +french![1],
        )
    return date && zonedDayRange(date, timeZone)
      ? { precision: "day", date, timeZone }
      : null
  }
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})t(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(z|[+-]\d{2}:?\d{2})$/.exec(
      text,
    )
  if (iso) {
    if (
      !civilDate(+iso[1], +iso[2], +iso[3]) ||
      +iso[4] > 23 ||
      +iso[5] > 59 ||
      +(iso[6] ?? 0) > 59
    )
      return null
    if (iso[8] !== "z" && (+iso[8].slice(1, 3) > 23 || +iso[8].slice(-2) > 59))
      return null
    const at = Date.parse(raw.trim())
    return Number.isFinite(at)
      ? { precision: "instant", at: new Date(at).toISOString() }
      : null
  }
  // Le parseur natif n'est autorisé qu'après validation du format RFC et du calendrier.
  const rss =
    /^(?:(?:mon|tue|wed|thu|fri|sat|sun),?\s+)?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+([+-]\d{4}|gmt|ut|utc|est|edt|cst|cdt|mst|mdt|pst|pdt))?$/.exec(
      text,
    )
  if (rss) {
    const month =
      [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(rss[2]) + 1
    if (
      !civilDate(+rss[3], month, +rss[1]) ||
      +rss[4] > 23 ||
      +rss[5] > 59 ||
      +(rss[6] ?? 0) > 59
    )
      return null
    if (!rss[7])
      return parseSourceDate(
        `${civilDate(+rss[3], month, +rss[1])}T${rss[4]}:${rss[5]}:${rss[6] ?? "00"}`,
        { timeZone },
      )
    if (
      /^[+-]/.test(rss[7]) &&
      (+rss[7].slice(1, 3) > 23 || +rss[7].slice(-2) > 59)
    )
      return null
    const at = Date.parse(raw.trim())
    return Number.isFinite(at)
      ? { precision: "instant", at: new Date(at).toISOString() }
      : null
  }
  const local =
    /^(\d{4})-(\d{2})-(\d{2})t(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?$/.exec(
      text,
    )
  if (local) {
    if (
      !civilDate(+local[1], +local[2], +local[3]) ||
      +local[4] > 23 ||
      +local[5] > 59 ||
      +(local[6] ?? 0) > 59
    )
      return null
    try {
      const target = Date.UTC(
        +local[1],
        +local[2] - 1,
        +local[3],
        +local[4],
        +local[5],
        +(local[6] ?? 0),
        Math.round(+(local[7] ?? 0) * 1000),
      )
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
      const localClock = (at: number) => {
        const parts = formatter.formatToParts(at)
        const part = (type: Intl.DateTimeFormatPartTypes) =>
          +parts.find((item) => item.type === type)!.value
        return Date.UTC(
          part("year"),
          part("month") - 1,
          part("day"),
          part("hour"),
          part("minute"),
          part("second"),
        )
      }
      const offsets = new Set<number>()
      for (const hours of [-36, -12, 0, 12, 36]) {
        const sample = Math.floor((target + hours * 3_600_000) / 1000) * 1000
        offsets.add(localClock(sample) - sample)
      }
      const candidates = [...offsets]
        .map((offset) => target - offset)
        .filter((at) => localClock(at) === Math.floor(target / 1000) * 1000)
      // Au changement d'heure, une heure locale ambiguë ou inexistante ne permet
      // pas de choisir un instant. L'adaptateur doit fournir son décalage.
      return candidates.length === 1
        ? { precision: "instant", at: new Date(candidates[0]).toISOString() }
        : null
    } catch {
      return null
    }
  }
  return null
}
