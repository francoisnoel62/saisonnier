import { FilePlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { MembershipBanner } from "@/components/company/membership-banner"
import { SectionCards } from "@/components/dashboard/section-cards"
import { Button } from "@/components/ui/button"
import { publicCompanyName } from "@/domain/application"
import { todayInParis } from "@/domain/offer-activity"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"
import { countEmployerOffers, managerOf } from "@/server/offers/employer-offers"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function EmployerHomePage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  // Premier passage : le compte se rattache d'abord à son entreprise.
  if (!membership) redirect("/employeur/entreprise")

  const { member, company } = membership
  const counts = await countEmployerOffers(
    managerOf(membership),
    todayInParis(new Date()),
  )

  return (
    <div className="flex flex-col gap-6">
      <MembershipBanner status={member.status} reviewNote={member.reviewNote} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight break-words">
          {publicCompanyName({ hideCompanyIdentity: false, company })}
        </h2>
        {member.status !== "rejected" && (
          <Button asChild>
            <Link href="/employeur/annonces/nouvelle">
              <FilePlusIcon data-icon="inline-start" aria-hidden />
              Déposer une annonce
            </Link>
          </Button>
        )}
      </div>

      <SectionCards
        cards={[
          {
            label: "En ligne",
            value: counts.online,
            description: "Visibles des candidats",
          },
          {
            label: "En attente de vérification",
            value: counts.pending_review,
            description: "Publiées dès la validation de votre rattachement",
          },
          {
            label: "Hors ligne ou expirées",
            value: counts.offline + counts.expired,
            description: "Invisibles des candidats",
          },
        ]}
      />

      <Button asChild variant="outline" className="self-start">
        <Link href="/employeur/annonces">Voir mes annonces</Link>
      </Button>
    </div>
  )
}
