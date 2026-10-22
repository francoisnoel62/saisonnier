import type { Metadata } from "next"

import {
  VerificationsTable,
  type VerificationRow,
} from "@/components/admin/verifications-table"
import {
  annuaireUrl,
  emailMatchesWebsite,
  relationshipLabel,
} from "@/domain/membership"
import { isTourismActivity, nafLabel } from "@/domain/naf"
import { listMembershipsForReview } from "@/server/companies/membership"

export const metadata: Metadata = { title: "Vérifications" }

// File de vérification des rattachements (H2) : l'admin décide, les indicateurs l'y aident.
export default async function VerificationsPage() {
  const memberships = await listMembershipsForReview()
  const rows: VerificationRow[] = memberships.map(({ company, ...member }) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    jobTitle: member.jobTitle,
    relationship: relationshipLabel(
      member.relationship,
      member.relationshipDetails,
    ),
    status: member.status,
    reviewNote: member.reviewNote,
    createdAt: member.createdAt.toISOString(),
    reviewedAt: member.reviewedAt?.toISOString() ?? null,
    companyName: company.legalName,
    displayName: company.displayName,
    siren: company.siren,
    siret: company.siret,
    annuaireUrl: company.siren ? annuaireUrl(company.siren) : null,
    nafCode: company.nafCode,
    nafLabel: company.nafLabel ?? nafLabel(company.nafCode),
    tourism: isTourismActivity(company.nafCode),
    communeName: company.communeName,
    website: company.website,
    emailMatchesSite: company.website
      ? emailMatchesWebsite(member.email, company.website)
      : null,
  }))

  return <VerificationsTable rows={rows} />
}
