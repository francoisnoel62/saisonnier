import { site } from "@/config/site"

import type { DurationUnit, OfferOrigin, Season, WorkTime } from "./offer"
import { assertIsoDate } from "./offer-activity"

// Libellés d'une offre montrés aux candidats : carte des résultats (plan 09), fiche (plan 11).

export const seasonLabels: Record<Season, string> = {
  summer: "Été",
  winter: "Hiver",
}

// H7 : `unknown` reste « Non précisé ».
export const workTimeLabels: Record<WorkTime, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  unknown: "Non précisé",
}

// Provenance de l'annonce (§6) : une annonce collectée n'a pas été confirmée par le recruteur.
export const originLabels: Record<OfferOrigin, string> = {
  deposited: "Déposée par l'employeur",
  collected: "Collectée sur le site de l'employeur",
}

const longDate = new Intl.DateTimeFormat(site.locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  // Une date de calendrier n'a pas de fuseau : lue et écrite en UTC, elle ne change pas de jour.
  timeZone: "UTC",
})

// "2026-08-10" → « 10 août 2026 ».
export function formatIsoDate(value: string) {
  assertIsoDate(value)
  return longDate.format(new Date(`${value}T00:00:00Z`))
}

export function durationLabel(value: number, unit: DurationUnit) {
  if (unit === "months") return `${value} mois`
  return value > 1 ? `${value} semaines` : `${value} semaine`
}

export type PeriodFields = {
  startDate?: string | null
  endDate?: string | null
  durationValue?: number | null
  durationUnit?: DurationUnit | null
}

// Période du contrat telle que l'annonce la donne : des dates précises, sinon la durée,
// complétée de la date connue (une date de début peut accompagner une durée).
export function contractPeriod({
  startDate: start,
  endDate: end,
  durationValue,
  durationUnit,
}: PeriodFields) {
  if (start && end) {
    return `Du ${formatIsoDate(start)} au ${formatIsoDate(end)}`
  }
  if (durationValue && durationUnit) {
    const duration = durationLabel(durationValue, durationUnit)
    if (start) return `${duration}, à partir du ${formatIsoDate(start)}`
    if (end) return `${duration}, jusqu'au ${formatIsoDate(end)}`
    return duration
  }
  // Exclu par la contrainte offers_period_or_duration ; affiché plutôt qu'inventé.
  return "Période non précisée"
}

const count = new Intl.NumberFormat(site.locale)

// Nombre de résultats : « Aucune offre », « 1 offre », « 1 234 offres ».
export function offerCountLabel(total: number) {
  if (total === 0) return "Aucune offre"
  return `${count.format(total)} offre${total > 1 ? "s" : ""}`
}
