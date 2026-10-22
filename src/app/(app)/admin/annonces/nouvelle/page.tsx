import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { OfferForm } from "@/components/offers/offer-form/offer-form"
import { Button } from "@/components/ui/button"
import { emptyAdminOfferFormValues } from "@/domain/offer-input"
import { listCompanyOptions } from "@/server/companies/companies"
import { saveAdminOffer } from "@/server/offers/admin-actions"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"

export const metadata: Metadata = { title: "Saisir une annonce" }

// Saisie d'une annonce collectée sur le site officiel d'un employeur (H10), ou transmise par un
// employeur sans compte.
export default async function AdminNewOfferPage() {
  const [referentials, companies] = await Promise.all([
    getOfferFormReferentials(),
    listCompanyOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/admin/annonces">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Annonces
        </Link>
      </Button>
      <OfferForm
        space="admin"
        mode="create"
        action={saveAdminOffer.bind(null, null)}
        defaultValues={emptyAdminOfferFormValues()}
        referentials={referentials}
        companies={companies}
        originLocked={false}
        companyLocked={false}
      />
    </div>
  )
}
