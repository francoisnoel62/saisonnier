import { findBlockedTargets } from "./blocked-domains"
import type { ApplicationChannel, OfferOrigin } from "./offer"

export const provenances = [
  "human_verified",
  "sourced",
  "verified_recruiter",
  "deposited",
] as const
export type Provenance = (typeof provenances)[number]
export const provenanceLabels: Record<Provenance, string> = {
  human_verified: "Vérifiée par un humain",
  sourced: "Sourcée sur internet",
  verified_recruiter: "Recruteur vérifié",
  deposited: "Déposée par l'employeur",
}

export type ProvenanceFields = {
  origin: OfferOrigin
  humanVerifiedAt?: Date | null
  createdBy?: { role: string } | null
}

export function provenanceOf(offer: ProvenanceFields): Provenance {
  if (offer.origin === "collected")
    return offer.humanVerifiedAt ? "human_verified" : "sourced"
  return offer.createdBy?.role === "employer"
    ? "verified_recruiter"
    : "deposited"
}

// Un formulaire sur un domaine devenu exclu est masqué par le panneau de candidature : il ne
// vaut plus « Candidature externe » (même règle que findBlockedTargets).
export function isExternalApplication(
  offer: {
    applicationChannel: ApplicationChannel
    applyEmail?: string | null
    applyPhone?: string | null
    applyUrl?: string | null
  },
  blockedDomains: readonly string[] = [],
) {
  return (
    offer.applicationChannel === "employer" &&
    !offer.applyEmail &&
    !offer.applyPhone &&
    !!offer.applyUrl &&
    findBlockedTargets({ applyUrl: offer.applyUrl }, blockedDomains).length ===
      0
  )
}

export type Newness = {
  kind: "employer" | "discovered" | "platform"
  date: string
  precision: "day" | "instant"
}
export function newnessOf(offer: {
  sourcePublishedDate?: string | null
  sourcePublishedAt?: Date | null
  firstDiscoveredAt?: Date | null
  publishedAt?: Date | null
}): Newness | null {
  if (offer.sourcePublishedDate)
    return {
      kind: "employer",
      date: offer.sourcePublishedAt?.toISOString() ?? offer.sourcePublishedDate,
      precision: offer.sourcePublishedAt ? "instant" : "day",
    }
  if (offer.firstDiscoveredAt)
    return {
      kind: "discovered",
      date: offer.firstDiscoveredAt.toISOString(),
      precision: "instant",
    }
  return offer.publishedAt
    ? {
        kind: "platform",
        date: offer.publishedAt.toISOString(),
        precision: "instant",
      }
    : null
}

export function newnessLabel(newness: Newness) {
  // Un jour civil ne doit pas se décaler dans le fuseau du navigateur.
  const date = new Date(
    newness.precision === "day"
      ? `${newness.date}T12:00:00+02:00`
      : newness.date,
  )
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
  const prefix = {
    employer: "Publiée par l'employeur",
    discovered: "Découverte",
    platform: "Publiée",
  }[newness.kind]
  return `${prefix} le ${formatted}`
}
