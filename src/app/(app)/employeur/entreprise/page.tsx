import type { Metadata } from "next"
import Link from "next/link"

import { CompanyDetailsForm } from "@/components/company/company-details-form"
import { MembershipBanner } from "@/components/company/membership-banner"
import { OnboardingForm } from "@/components/company/onboarding-form"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  membershipStatusLabels,
  relationshipLabel,
  type MembershipStatus,
} from "@/domain/membership"
import { requireRole } from "@/lib/dal"
import { formatDate } from "@/lib/format"
import {
  searchCompanies,
  submitOnboarding,
  updateCompany,
} from "@/server/companies/actions"
import { getMembership } from "@/server/companies/membership"

export const metadata: Metadata = { title: "Mon entreprise" }

const statusVariant: Record<
  MembershipStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
}

// Onboarding tant qu'aucun rattachement n'existe ; ensuite, fiche de l'entreprise et statut.
export default async function CompanyPage() {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)

  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Rattacher votre compte à votre entreprise</h2>
            </CardTitle>
            <CardDescription>
              Les candidats doivent savoir qui recrute. Indiquez votre
              entreprise et votre rôle : nous vérifions chaque rattachement
              avant de publier vos annonces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              action={submitOnboarding}
              search={searchCompanies}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const { member, company } = membership
  const rows: [string, string | null][] = [
    ["Raison sociale", company.legalName],
    ["Nom d'usage ou enseigne", company.displayName],
    ["SIREN", company.siren],
    ["SIRET", company.siret],
    [
      "Activité principale",
      company.nafCode
        ? [company.nafCode, company.nafLabel].filter(Boolean).join(" — ")
        : null,
    ],
    ["Commune", company.communeName],
    ["Site web", company.website],
  ]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <MembershipBanner status={member.status} reviewNote={member.reviewNote} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{company.displayName ?? company.legalName}</h2>
          </CardTitle>
          <CardDescription>
            Pour changer de SIREN,{" "}
            <Link
              href="/contact?motif=employeur"
              className="underline underline-offset-4"
            >
              écrivez-nous
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mb-2 break-words sm:mb-0">
                  {value ?? "Non renseigné"}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Votre rattachement</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Statut</dt>
            <dd className="mb-2 sm:mb-0">
              <Badge variant={statusVariant[member.status]}>
                {membershipStatusLabels[member.status]}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Fonction</dt>
            <dd className="mb-2 sm:mb-0">{member.jobTitle}</dd>
            <dt className="text-muted-foreground">
              Lien avec l&rsquo;entreprise
            </dt>
            <dd className="mb-2 sm:mb-0">
              {relationshipLabel(
                member.relationship,
                member.relationshipDetails,
              )}
            </dd>
            <dt className="text-muted-foreground">Demande envoyée le</dt>
            <dd className="mb-2 sm:mb-0">{formatDate(member.createdAt)}</dd>
            {member.reviewedAt && (
              <>
                <dt className="text-muted-foreground">Décision le</dt>
                <dd>{formatDate(member.reviewedAt)}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {member.status !== "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Modifier vos informations</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyDetailsForm
              action={updateCompany}
              defaults={{
                displayName: company.displayName ?? "",
                website: company.website ?? "",
                phone: member.phone ?? "",
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
