import { FilePlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  AdminOffersTable,
  type AdminOfferRow,
} from "@/components/admin/admin-offers-table"
import { savedOfferPreview } from "@/components/offers/offer-preview-data"
import { Button } from "@/components/ui/button"
import { adminRepublishRefusal, canAdminUnpublish } from "@/domain/admin-offer"
import { findBlockedTargets } from "@/domain/blocked-domains"
import { employerOfferState } from "@/domain/employer-offer"
import { todayInParis } from "@/domain/offer-activity"
import { contractPeriod } from "@/domain/offer-display"
import { blockedTargetMessage } from "@/domain/offer-minimum"
import { listAdminOffers, type AdminOffer } from "@/server/offers/admin-offers"
import { getBlockedDomains } from "@/server/offers/application"

export const metadata: Metadata = { title: "Annonces" }

function toRow(
  offer: AdminOffer,
  today: string,
  blockedDomains: readonly string[],
): AdminOfferRow {
  const state = employerOfferState(offer, today)
  const { company } = offer
  return {
    id: offer.id,
    title: offer.title,
    origin: offer.origin,
    state,
    companyName: company.displayName
      ? `${company.displayName} (${company.legalName})`
      : company.legalName,
    anonymous: offer.hideCompanyIdentity,
    recruiterName:
      offer.applicationChannel === "recruiter" ? offer.recruiterName : null,
    location: `${offer.communeName} (${offer.departmentCode})`,
    period: contractPeriod(offer),
    sourceUrl: offer.sourceUrl,
    sourceName: offer.sourceName,
    sourceCheckedAt: offer.sourceCheckedAt?.toISOString() ?? null,
    validityConfirmedAt: offer.validityConfirmedAt?.toISOString() ?? null,
    blocked: findBlockedTargets(offer, blockedDomains).map(
      blockedTargetMessage,
    ),
    // Une annonce publiée mais échue n'est déjà plus visible : on corrige ses dates.
    canUnpublish: canAdminUnpublish(offer) && state === "online",
    canRepublish: adminRepublishRefusal(offer, today) === null,
    preview: savedOfferPreview(offer, blockedDomains),
  }
}

// Toutes les annonces (§6) : déposées par les employeurs ou collectées sur leurs sites officiels.
// Les corrections des annonces collectées passent par ici, jamais par l'espace employeur.
export default async function AdminOffersPage() {
  const today = todayInParis(new Date())
  const [offers, blockedDomains] = await Promise.all([
    listAdminOffers(),
    getBlockedDomains(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Les annonces collectées se saisissent ici, avec le lien de leur source
          sur le site officiel de l&rsquo;employeur. Les demandes des employeurs
          arrivent dans{" "}
          <Link
            href="/admin/demandes"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Demandes & messages
          </Link>
          .
        </p>
        <Button asChild>
          <Link href="/admin/annonces/nouvelle">
            <FilePlusIcon data-icon="inline-start" aria-hidden />
            Saisir une annonce
          </Link>
        </Button>
      </div>
      <AdminOffersTable
        rows={offers.map((offer) => toRow(offer, today, blockedDomains))}
      />
    </div>
  )
}
