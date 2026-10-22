import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ComingSoon } from "@/components/coming-soon"
import { MembershipBanner } from "@/components/company/membership-banner"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function EmployerHomePage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  // Premier passage : le compte se rattache d'abord à son entreprise.
  if (!membership) redirect("/employeur/entreprise")

  return (
    <>
      <MembershipBanner
        status={membership.member.status}
        reviewNote={membership.member.reviewNote}
      />
      <ComingSoon />
    </>
  )
}
