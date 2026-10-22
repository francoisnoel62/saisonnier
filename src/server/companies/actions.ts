"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  companyDetailsSchema,
  companyOnboardingSchema,
  membershipDecisionSchema,
  relationshipLabel,
  type CompanyOnboarding,
} from "@/domain/membership"
import { requireRole } from "@/lib/dal"
import { sendEmail } from "@/lib/email/send"
import {
  membershipDecisionEmail,
  membershipRequestEmail,
} from "@/lib/email/templates"
import { env } from "@/lib/env"

import { searchCompanyDirectory } from "./directory"
import {
  createMembership,
  decideMembership,
  MembershipExistsError,
  updateCompanyDetails,
} from "./membership"

export type FormState<Field extends string> = {
  saved?: boolean
  message?: string
  fieldErrors?: Partial<Record<Field, string[]>>
  // Réaffichées après une erreur.
  values?: Partial<Record<Field, string>>
}

// Le statut du rattachement s'affiche sur toutes les pages employeur (bannière du layout).
function revalidateEmployer() {
  revalidatePath("/employeur", "layout")
  revalidatePath("/admin/verifications")
}

export async function searchCompanies(query: string) {
  await requireRole("employer")
  return searchCompanyDirectory(String(query).slice(0, 100))
}

export type OnboardingField = keyof CompanyOnboarding

const onboardingFields = [
  "legalName",
  "siren",
  "siret",
  "nafCode",
  "nafLabel",
  "communeName",
  "displayName",
  "website",
  "jobTitle",
  "relationship",
  "relationshipDetails",
  "phone",
] as const

export async function submitOnboarding(
  _state: FormState<OnboardingField>,
  formData: FormData,
): Promise<FormState<OnboardingField>> {
  const { user } = await requireRole("employer")
  const values = Object.fromEntries(
    onboardingFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<(typeof onboardingFields)[number], string>

  const parsed = companyOnboardingSchema.safeParse({
    ...values,
    certified: formData.get("certified") === "on",
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const input = parsed.data
  let created
  try {
    created = await createMembership(user.id, input)
  } catch (error) {
    if (error instanceof MembershipExistsError) {
      revalidateEmployer()
      return { message: error.message }
    }
    throw error
  }

  // Le rattachement est enregistré : un échec d'envoi ne doit pas le faire perdre.
  const { company } = created
  try {
    await sendEmail({
      to: env.ADMIN_NOTIFICATION_EMAIL,
      replyTo: user.email,
      ...membershipRequestEmail({
        name: user.name,
        email: user.email,
        jobTitle: input.jobTitle,
        relationship: relationshipLabel(
          input.relationship,
          input.relationshipDetails,
        ),
        companyName: company.legalName,
        siren: company.siren ?? input.siren,
        activity: company.nafCode
          ? `${company.nafCode} ${company.nafLabel ?? ""}`.trim()
          : "non renseignée",
        website: company.website,
        url: `${env.BETTER_AUTH_URL}/admin/verifications`,
      }),
    })
  } catch (error) {
    console.error(
      `Notification du rattachement de ${user.id} impossible`,
      error,
    )
  }

  revalidateEmployer()
  return { saved: true }
}

export type CompanyDetailsField = "displayName" | "website" | "phone"

export async function updateCompany(
  _state: FormState<CompanyDetailsField>,
  formData: FormData,
): Promise<FormState<CompanyDetailsField>> {
  const { user } = await requireRole("employer")
  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    website: String(formData.get("website") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  }

  const parsed = companyDetailsSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }
  const result = await updateCompanyDetails(user.id, parsed.data)
  revalidateEmployer()
  if (!result.updated) {
    return { message: "Ce rattachement ne peut plus être modifié.", values }
  }
  return {
    saved: true,
    message: result.companyUpdated
      ? undefined
      : "Seul le téléphone a été enregistré : l'enseigne et le site de cette entreprise sont gérés par un déposant déjà vérifié.",
  }
}

export type ReviewState = { done?: boolean; message?: string }

export async function reviewMembership(
  _state: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const { user: admin } = await requireRole("admin")

  const parsed = membershipDecisionSchema.safeParse({
    decision: formData.get("decision"),
    userId: formData.get("userId"),
    reviewNote: formData.get("reviewNote") ?? undefined,
  })
  if (!parsed.success) {
    return {
      message:
        parsed.error.issues.find((issue) => issue.path[0] === "reviewNote")
          ?.message ?? "Décision invalide.",
    }
  }

  const decision = parsed.data
  const result = await decideMembership(admin.id, decision)
  revalidateEmployer()
  if (!result) {
    return { message: "Cette demande a déjà été traitée ou n'existe plus." }
  }
  if (result.offerIds.length > 0) revalidatePath("/offres", "layout")

  try {
    await sendEmail({
      to: result.email,
      ...membershipDecisionEmail({
        name: result.name,
        companyName: result.displayName ?? result.legalName,
        decision: decision.decision,
        reviewNote:
          decision.decision === "reject" ? decision.reviewNote : undefined,
        url:
          decision.decision === "verify"
            ? `${env.BETTER_AUTH_URL}/employeur/annonces`
            : `${env.BETTER_AUTH_URL}/contact?motif=employeur`,
      }),
    })
  } catch (error) {
    console.error(
      `Email de décision du rattachement ${result.member.userId} impossible`,
      error,
    )
  }
  return { done: true }
}
