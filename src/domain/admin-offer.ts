import { expiryRefusal, type OfferStateFields } from "./employer-offer"
import type { OfferOrigin } from "./offer"

// Back-office (plan 15) : le fondateur gère toutes les annonces, déposées comme collectées (§6).

// Mettre hors ligne : toute annonce publiée, à la demande de l'employeur par exemple.
export function canAdminUnpublish(offer: OfferStateFields) {
  return offer.status === "published"
}

// Remettre en ligne : une annonce retirée ou expirée, si aucune échéance n'est dépassée. Une
// annonce en attente ou refusée dépend de la vérification de son déposant (H2), pas de ce bouton.
// Renvoie le motif du refus, ou null.
export function adminRepublishRefusal(offer: OfferStateFields, today: string) {
  if (offer.status !== "unpublished" && offer.status !== "expired") {
    return "Seule une annonce hors ligne ou expirée se remet en ligne."
  }
  return expiryRefusal(offer, today)
}

// « Source vérifiée aujourd'hui » : seule une annonce collectée a une source à suivre.
export function hasSource(offer: { origin: OfferOrigin }) {
  return offer.origin === "collected"
}
