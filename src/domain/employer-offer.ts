import type { MembershipStatus } from "./membership"
import type { ApplicationChannel, OfferOrigin, OfferStatus } from "./offer"
import { expiryReason } from "./offer-activity"

// Annonces déposées, vues et gérées depuis l'espace employeur (§6, H2).

// État montré à l'employeur. Une annonce publiée dont l'échéance est passée n'est plus en ligne,
// même avant le passage du job d'expiration (plan 16).
export const employerOfferStates = [
  "online",
  "pending_review",
  "offline",
  "expired",
  "rejected",
] as const
export type EmployerOfferState = (typeof employerOfferStates)[number]

export const employerOfferStateLabels: Record<EmployerOfferState, string> = {
  online: "En ligne",
  pending_review: "En attente de vérification",
  offline: "Hors ligne",
  expired: "Expirée",
  rejected: "Refusée",
}

export type OfferStateFields = {
  status: OfferStatus
  applicationDeadline?: string | null
  endDate?: string | null
}

export function employerOfferState(
  offer: OfferStateFields,
  today: string,
): EmployerOfferState {
  switch (offer.status) {
    case "published":
      return expiryReason(offer, today) === null ? "online" : "expired"
    case "pending_review":
      return "pending_review"
    case "unpublished":
      return "offline"
    case "expired":
      return "expired"
    case "rejected":
      return "rejected"
  }
}

// Le déposant connecté, tel que son rattachement le décrit.
export type OfferManager = {
  userId: string
  companyId: string
  status: MembershipStatus
}

export type ManagedOfferFields = OfferStateFields & {
  origin: OfferOrigin
  companyId: string
  createdByUserId: string | null
  applicationChannel: ApplicationChannel
}

// Annonces de l'espace employeur : les annonces déposées de son entreprise. Avant d'être vérifié, un
// déposant ne voit que les siennes : rattaché sans contrôle, il n'a accès à aucune autre (H2). Les
// annonces collectées n'y figurent jamais : leurs corrections passent par le fondateur (§6).
export function canViewOffer(manager: OfferManager, offer: ManagedOfferFields) {
  return (
    offer.origin === "deposited" &&
    offer.companyId === manager.companyId &&
    (manager.status === "verified" || offer.createdByUserId === manager.userId)
  )
}

// Modifier : ni une annonce refusée, ni une annonce dont le recrutement est confié au service
// (plan 15). Un déposant refusé ne modifie plus rien ; un déposant en attente ne modifie que ses
// annonces en attente, qui le restent.
export function canEditOffer(manager: OfferManager, offer: ManagedOfferFields) {
  if (!canViewOffer(manager, offer) || manager.status === "rejected") {
    return false
  }
  if (offer.status === "rejected" || offer.applicationChannel !== "employer") {
    return false
  }
  return manager.status === "verified" || offer.status === "pending_review"
}

// Mettre hors ligne : une annonce publiée, par un déposant vérifié.
export function canUnpublishOffer(
  manager: OfferManager,
  offer: ManagedOfferFields,
) {
  return (
    canViewOffer(manager, offer) &&
    manager.status === "verified" &&
    offer.status === "published"
  )
}

// Remettre en ligne : une annonce retirée ou expirée, par un déposant vérifié, et seulement si
// aucune échéance n'est dépassée (§6). Renvoie le motif du refus, ou null.
export function republishRefusal(
  manager: OfferManager,
  offer: ManagedOfferFields,
  today: string,
) {
  if (
    !canViewOffer(manager, offer) ||
    manager.status !== "verified" ||
    (offer.status !== "unpublished" && offer.status !== "expired")
  ) {
    return "Cette annonce ne peut pas être remise en ligne."
  }
  return expiryRefusal(offer, today)
}

// Échéance qui empêche la remise en ligne d'une annonce, ou null (§6, H18).
export function expiryRefusal(offer: OfferStateFields, today: string) {
  switch (expiryReason(offer, today)) {
    case "deadline":
      return "La date limite de candidature est passée : modifiez-la avant de remettre l'annonce en ligne."
    case "end_date":
      return "La date de fin du contrat est passée : modifiez-la avant de remettre l'annonce en ligne."
    case null:
      return null
  }
}
