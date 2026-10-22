import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { MembershipBanner } from "@/components/company/membership-banner"
import { OfferForm } from "@/components/offers/offer-form/offer-form"
import { canPublishDirectly } from "@/domain/membership"
import { emptyOfferFormValues } from "@/domain/offer-input"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"
import { createOffer } from "@/server/offers/employer-actions"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"

export const metadata: Metadata = { title: "Déposer une annonce" }

export default async function NewOfferPage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  // Premier passage : le compte se rattache d'abord à son entreprise.
  if (!membership) redirect("/employeur/entreprise")
  const { member, company } = membership

  // Rattachement refusé : la bannière l'explique, aucun dépôt n'est possible.
  if (member.status === "rejected") {
    return (
      <MembershipBanner status={member.status} reviewNote={member.reviewNote} />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <MembershipBanner status={member.status} reviewNote={member.reviewNote} />
      <p className="max-w-3xl text-sm text-muted-foreground">
        Seul le minimum de publication est obligatoire : contrat saisonnier,
        lieu, période et contact direct. Complétez le reste si vous le
        connaissez ; une information laissée vide s&rsquo;affiche «&nbsp;Non
        précisé&nbsp;» aux candidats.
      </p>
      <OfferForm
        mode="create"
        action={createOffer}
        defaultValues={emptyOfferFormValues()}
        referentials={await getOfferFormReferentials()}
        company={{
          id: company.id,
          legalName: company.legalName,
          displayName: company.displayName,
        }}
        publishesDirectly={canPublishDirectly(member.status)}
      />
    </div>
  )
}
