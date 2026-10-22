import { ArrowLeftIcon, CircleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { MembershipBanner } from "@/components/company/membership-banner"
import { OfferForm } from "@/components/offers/offer-form/offer-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  canEditOffer,
  employerOfferState,
  employerOfferStateLabels,
} from "@/domain/employer-offer"
import { canPublishDirectly } from "@/domain/membership"
import { todayInParis } from "@/domain/offer-activity"
import { offerToFormValues } from "@/domain/offer-input"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"
import { updateOffer } from "@/server/offers/employer-actions"
import {
  getEmployerOffer,
  getOfferFormReferentials,
  managerOf,
} from "@/server/offers/employer-offers"

export const metadata: Metadata = { title: "Modifier une annonce" }

function BackLink() {
  return (
    <Button asChild variant="ghost" className="self-start">
      <Link href="/employeur/annonces">
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        Mes annonces
      </Link>
    </Button>
  )
}

// Modifier une annonce déposée de l'entreprise : son statut ne change pas (en ligne, elle le reste).
export default async function EditOfferPage({
  params,
}: PageProps<"/employeur/annonces/[id]/modifier">) {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  if (!membership) redirect("/employeur/entreprise")

  const manager = managerOf(membership)
  const offer = await getEmployerOffer(manager, (await params).id)
  // Ni une annonce collectée, ni celle d'une autre entreprise (§6).
  if (!offer) notFound()

  const state = employerOfferState(offer, todayInParis(new Date()))
  const header = (
    <div className="flex flex-col gap-6">
      <MembershipBanner
        status={membership.member.status}
        reviewNote={membership.member.reviewNote}
      />
      <div className="flex flex-col gap-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight break-words">
            {offer.title}
          </h2>
          <Badge variant="outline">{employerOfferStateLabels[state]}</Badge>
        </div>
      </div>
    </div>
  )

  if (!canEditOffer(manager, offer)) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {header}
        <Alert>
          <CircleAlertIcon aria-hidden />
          <AlertTitle>Cette annonce ne se modifie pas ici</AlertTitle>
          <AlertDescription>
            <p>
              Pour la corriger,{" "}
              <Link
                href={`/contact?motif=employeur&offre=${offer.id}`}
                className="underline underline-offset-4"
              >
                contactez-nous
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <OfferForm
        space="employer"
        mode="edit"
        action={updateOffer.bind(null, offer.id)}
        defaultValues={offerToFormValues(offer)}
        referentials={await getOfferFormReferentials(offer.occupationId)}
        company={{
          id: offer.company.id,
          legalName: offer.company.legalName,
          displayName: offer.company.displayName,
        }}
        publishesDirectly={canPublishDirectly(membership.member.status)}
      />
    </div>
  )
}
