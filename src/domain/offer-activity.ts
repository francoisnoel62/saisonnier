import type { OfferStatus } from "./offer"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Date de calendrier existante au format AAAA-MM-JJ, celui des colonnes `date` : à ce format,
// l'ordre des chaînes est celui des dates.
export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

// Une date mal formée (un horodatage ISO, par exemple) fausserait les comparaisons en silence.
export function assertIsoDate(value: string) {
  if (!isIsoDate(value)) {
    throw new Error(`Date attendue au format AAAA-MM-JJ : « ${value} ».`)
  }
}

const parisDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

// « Aujourd'hui » au sens des échéances : la date du jour à Paris, au format AAAA-MM-JJ.
export function todayInParis(now: Date) {
  const parts = Object.fromEntries(
    parisDate.formatToParts(now).map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export type ExpiryReason = "deadline" | "end_date"

export type ActivityFields = {
  status: OfferStatus
  applicationDeadline?: string | null
  endDate?: string | null
}

// Échéance dépassée (§6) : la date limite de candidature, puis la fin du contrat. Elles restent
// valables le jour même. Une date de début passée ne compte pas : un remplacement peut encore
// être recherché.
export function expiryReason(
  offer: Omit<ActivityFields, "status">,
  today: string,
): ExpiryReason | null {
  assertIsoDate(today)
  if (offer.applicationDeadline && offer.applicationDeadline < today) {
    return "deadline"
  }
  if (offer.endDate && offer.endDate < today) return "end_date"
  return null
}

// Visible des candidats : publiée, sans échéance dépassée. Même règle, en SQL, que
// activeOfferConditions (src/server/offers/queries.ts).
export function isActive(offer: ActivityFields, today: string) {
  return offer.status === "published" && expiryReason(offer, today) === null
}
