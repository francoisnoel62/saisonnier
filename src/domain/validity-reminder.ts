import type { OfferOrigin, OfferStatus } from "./offer"

// Rappel de validité (§6, plan 16) : tous les 30 jours, le déposant confirme que son annonce est
// toujours valable. Sans réponse, elle reste en ligne : aucun retrait automatique.

export const REMINDER_INTERVAL_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export type ValidityFields = {
  origin: OfferOrigin
  status: OfferStatus
  publishedAt: Date | null
  validityConfirmedAt: Date | null
  validityReminderSentAt: Date | null
}

// Dernier signe de vie de l'annonce : sa publication, la dernière confirmation ou le dernier rappel.
export function lastValiditySignal(offer: ValidityFields) {
  const times = [
    offer.publishedAt,
    offer.validityConfirmedAt,
    offer.validityReminderSentAt,
  ].flatMap((date) => (date ? [date.getTime()] : []))
  return times.length > 0 ? new Date(Math.max(...times)) : null
}

// Un rappel est dû pour une annonce déposée et publiée, 30 jours après son dernier signe de vie.
// Une annonce collectée se vérifie à sa source, par le fondateur : jamais de rappel.
export function isReminderDue(offer: ValidityFields, now: Date) {
  if (offer.origin !== "deposited" || offer.status !== "published") {
    return false
  }
  const last = lastValiditySignal(offer)
  return (
    last !== null &&
    last.getTime() <= now.getTime() - REMINDER_INTERVAL_DAYS * DAY_MS
  )
}

// L'espace employeur demande « Toujours valable ? » tant que le dernier rappel attend sa réponse.
export function awaitsValidityAnswer(
  offer: Pick<
    ValidityFields,
    "status" | "validityConfirmedAt" | "validityReminderSentAt"
  >,
) {
  return (
    offer.status === "published" &&
    offer.validityReminderSentAt !== null &&
    (offer.validityConfirmedAt === null ||
      offer.validityReminderSentAt > offer.validityConfirmedAt)
  )
}
