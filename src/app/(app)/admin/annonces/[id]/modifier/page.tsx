import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { OfferForm } from "@/components/offers/offer-form/offer-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  employerOfferState,
  employerOfferStateLabels,
} from "@/domain/employer-offer"
import { todayInParis } from "@/domain/offer-activity"
import { originLabels } from "@/domain/offer-display"
import { adminOfferToFormValues } from "@/domain/offer-input"
import { listCompanyOptions } from "@/server/companies/companies"
import { saveAdminOffer } from "@/server/offers/admin-actions"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"
import { getOfferWithRelations } from "@/server/offers/queries"

export const metadata: Metadata = { title: "Modifier une annonce" }

// Toute annonce se modifie ici : une annonce collectée (seul le fondateur la corrige, §6), ou une
// annonce déposée dont l'employeur demande la correction ou confie le recrutement au service.
export default async function AdminEditOfferPage({
  params,
}: PageProps<"/admin/annonces/[id]/modifier">) {
  const offer = await getOfferWithRelations((await params).id)
  if (!offer) notFound()

  const [referentials, companies] = await Promise.all([
    getOfferFormReferentials(offer.occupationId),
    listCompanyOptions(),
  ])
  const state = employerOfferState(offer, todayInParis(new Date()))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="self-start">
          <Link href="/admin/annonces">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            Annonces
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight break-words">
            {offer.title}
          </h2>
          <Badge variant="outline">{employerOfferStateLabels[state]}</Badge>
          <Badge variant="outline">{originLabels[offer.origin]}</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {offer.origin === "deposited"
            ? "Son statut ne change pas : une annonce en ligne le reste, une annonce en attente attend toujours la vérification de son déposant."
            : "L'enregistrement remet l'annonce en ligne et date la vérification de sa source à aujourd'hui."}
        </p>
      </div>
      <OfferForm
        space="admin"
        mode="edit"
        action={saveAdminOffer.bind(null, offer.id)}
        defaultValues={adminOfferToFormValues(offer)}
        referentials={referentials}
        companies={companies}
        originLocked
        companyLocked={offer.origin === "deposited"}
      />
    </div>
  )
}
