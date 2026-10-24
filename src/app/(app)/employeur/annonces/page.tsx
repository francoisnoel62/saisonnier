import { FilePlusIcon, MegaphoneIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { MembershipBanner } from "@/components/company/membership-banner"
import {
  EmployerOffersTable,
  type EmployerOfferRow,
} from "@/components/offers/employer-offers-table"
import { savedOfferPreview } from "@/components/offers/offer-preview-data"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  canConfirmValidity,
  canEditOffer,
  canUnpublishOffer,
  employerOfferState,
  type EmployerOfferState,
  type OfferManager,
} from "@/domain/employer-offer"
import { expiryReason, todayInParis } from "@/domain/offer-activity"
import { contractPeriod, seasonLabels } from "@/domain/offer-display"
import { awaitsValidityAnswer } from "@/domain/validity-reminder"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"
import { getBlockedDomains } from "@/server/offers/application"
import {
  listEmployerOffers,
  managerOf,
  type EmployerOffer,
} from "@/server/offers/employer-offers"

export const metadata: Metadata = { title: "Mes annonces" }

// Précision sous le statut : ce qui empêche l'annonce d'être vue, et comment y remédier (§6).
function noteFor(
  offer: EmployerOffer,
  state: EmployerOfferState,
  today: string,
  canEdit: boolean,
) {
  if (state === "pending_review") {
    return "Publiée dès la vérification de votre rattachement."
  }
  if (state !== "expired" && state !== "offline") return null
  if (expiryReason(offer, today)) {
    return canEdit
      ? "Échéance passée : modifiez ses dates pour la remettre en ligne."
      : "Échéance passée."
  }
  return offer.status === "expired"
    ? "Dates corrigées : vous pouvez la remettre en ligne."
    : null
}

function toRow(
  offer: EmployerOffer,
  manager: OfferManager,
  today: string,
  blockedDomains: readonly string[],
): EmployerOfferRow {
  const state = employerOfferState(offer, today)
  const canEdit = canEditOffer(manager, offer)
  return {
    id: offer.id,
    title: offer.title,
    state,
    note: noteFor(offer, state, today, canEdit),
    location: `${offer.communeName} (${offer.departmentCode})`,
    season: offer.season ? seasonLabels[offer.season] : "Non précisée",
    period: contractPeriod(offer),
    validityConfirmedAt: offer.validityConfirmedAt?.toISOString() ?? null,
    awaitsValidity:
      awaitsValidityAnswer(offer) && canConfirmValidity(manager, offer),
    canEdit,
    // Une annonce publiée mais échue n'est déjà plus visible : on corrige ses dates.
    canUnpublish: canUnpublishOffer(manager, offer) && state === "online",
    // Le serveur refuse la remise en ligne tant qu'une échéance est dépassée (§6).
    canRepublish:
      manager.status === "verified" &&
      (offer.status === "unpublished" || offer.status === "expired"),
    preview: savedOfferPreview(offer, blockedDomains),
  }
}

// Annonces déposées de l'entreprise (§6). Les annonces collectées n'y figurent jamais : elles se
// corrigent par l'intermédiaire du fondateur.
export default async function EmployerOffersPage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  if (!membership) redirect("/employeur/entreprise")

  const manager = managerOf(membership)
  const today = todayInParis(new Date())
  const [offers, blockedDomains] = await Promise.all([
    listEmployerOffers(manager),
    getBlockedDomains(),
  ])
  const rows = offers.map((offer) =>
    toRow(offer, manager, today, blockedDomains),
  )
  const canDeposit = membership.member.status !== "rejected"

  return (
    <div className="flex flex-col gap-6">
      <MembershipBanner
        status={membership.member.status}
        reviewNote={membership.member.reviewNote}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Une annonce reste en ligne tant que vous la maintenez, jusqu&rsquo;à
          sa date limite de candidature ou la fin du contrat. Une annonce
          reprise de votre site se corrige en{" "}
          <Link
            href="/contact?motif=annonce-collectee"
            className="underline underline-offset-4 hover:text-foreground"
          >
            nous écrivant
          </Link>
          .
        </p>
        {canDeposit && (
          <Button asChild>
            <Link href="/employeur/annonces/nouvelle">
              <FilePlusIcon data-icon="inline-start" aria-hidden />
              Déposer une annonce
            </Link>
          </Button>
        )}
      </div>

      {rows.length > 0 ? (
        <EmployerOffersTable rows={rows} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MegaphoneIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Aucune annonce pour l&rsquo;instant</EmptyTitle>
            <EmptyDescription>
              Une annonce est publiable dès que le minimum est renseigné :
              contrat saisonnier, lieu, période et contact direct.
            </EmptyDescription>
          </EmptyHeader>
          {canDeposit && (
            <EmptyContent>
              <Button asChild>
                <Link href="/employeur/annonces/nouvelle">
                  Déposer une annonce
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
