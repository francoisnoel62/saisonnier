// Vocabulaire de l'offre. Les enums Postgres (src/lib/db/schema/offers.ts) sont construits
// à partir de ces listes : c'est la seule définition de leurs valeurs.

// Annonce déposée par l'employeur, ou collectée sur son site ou son portail officiel (§2).
export const offerOrigins = ["deposited", "collected"] as const
export type OfferOrigin = (typeof offerOrigins)[number]

// Seules les annonces `published` peuvent être visibles des candidats (voir offer-activity.ts).
export const offerStatuses = [
  "pending_review",
  "published",
  "unpublished",
  "expired",
  "rejected",
] as const
export type OfferStatus = (typeof offerStatuses)[number]

export const seasons = ["summer", "winter"] as const
export type Season = (typeof seasons)[number]

export const durationUnits = ["weeks", "months"] as const
export type DurationUnit = (typeof durationUnits)[number]

// H7 : temps plein ou partiel ; `unknown` vaut « Non précisé ».
export const workTimes = ["full_time", "part_time", "unknown"] as const
export type WorkTime = (typeof workTimes)[number]

// `recruiter` : recrutement confié au chargé de recrutement du service (§3, §7).
export const applicationChannels = ["employer", "recruiter"] as const
export type ApplicationChannel = (typeof applicationChannels)[number]
