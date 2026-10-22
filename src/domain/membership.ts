import { z } from "zod"

import { isPhoneNumber } from "./phone"

// Rattachement d'un employeur à son entreprise, vérifié par l'admin avant toute publication (H2).
export const membershipStatuses = ["pending", "verified", "rejected"] as const
export type MembershipStatus = (typeof membershipStatuses)[number]

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  pending: "En vérification",
  verified: "Vérifié",
  rejected: "Refusé",
}

// Lien du déposant avec l'entreprise ; « autre » se précise en texte libre.
export const memberRelationships = [
  "executive",
  "hr",
  "site_manager",
  "other",
] as const
export type MemberRelationship = (typeof memberRelationships)[number]

export const memberRelationshipLabels: Record<MemberRelationship, string> = {
  executive: "Dirigeant·e",
  hr: "RH / recrutement",
  site_manager: "Responsable d'établissement",
  other: "Autre",
}

export function relationshipLabel(
  relationship: MemberRelationship,
  details: string | null,
) {
  return relationship === "other" && details
    ? `Autre : ${details}`
    : memberRelationshipLabels[relationship]
}

// §6, H2 : seul un déposant vérifié publie sans modération ; avant, ses annonces attendent.
export function canPublishDirectly(status: MembershipStatus | null) {
  return status === "verified"
}

// Hôte d'un site saisi avec ou sans protocole, sans « www. » : null s'il n'est pas lisible.
export function websiteHost(website: string | null | undefined) {
  const value = website?.trim()
  if (!value) return null
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    )
    const host = url.hostname.toLowerCase().replace(/\.$/, "")
    return host.includes(".") ? host.replace(/^www\./, "") : null
  } catch {
    return null
  }
}

// Aide à la vérification, jamais une décision : le domaine de l'email est celui du site, ou
// l'un de ses sous-domaines (rh@mail.hotel.fr pour www.hotel.fr), ou l'inverse.
export function emailMatchesWebsite(
  email: string,
  website: string | null | undefined,
) {
  const host = websiteHost(website)
  const at = email.lastIndexOf("@")
  if (!host || at < 0) return false
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  if (!domain) return false
  return (
    domain === host ||
    domain.endsWith(`.${host}`) ||
    host.endsWith(`.${domain}`)
  )
}

// Clé de Luhn des numéros SIREN et SIRET : elle détecte les fautes de frappe.
function luhnValid(digits: string) {
  let sum = 0
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

// La Poste : un seul SIREN pour des milliers d'établissements, dont les SIRET échappent à Luhn.
const LA_POSTE_SIREN = "356000000"

export function isValidSiren(siren: string) {
  return /^\d{9}$/.test(siren) && luhnValid(siren)
}

export function isValidSiret(siret: string) {
  if (!/^\d{14}$/.test(siret)) return false
  return siret.startsWith(LA_POSTE_SIREN) || luhnValid(siret)
}

// Fiche de l'Annuaire des entreprises, pour vérifier une entreprise à sa source.
export function annuaireUrl(siren: string) {
  return `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`
}

// Formulaires du rattachement. Les contraintes CHECK de companies et company_members y sont
// toutes reprises ; un texte absent devient null.

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)

const requiredText = (max: number, empty: string, tooLong: string) =>
  z.string().trim().min(1, empty).max(max, tooLong)

// Espaces et points retirés : « 844 190 652 » vaut « 844190652 ».
const digits = (value: string) => value.replace(/[\s.]/g, "")

const phone = z
  .string()
  .trim()
  .min(1, "Indiquez un téléphone professionnel.")
  .max(30, "Le téléphone ne doit pas dépasser 30 caractères.")
  .refine(isPhoneNumber, "Saisissez un numéro de téléphone valide.")

// Adresse du site, complétée en https:// si le protocole manque.
const website = optionalText(
  200,
  "L'adresse du site ne doit pas dépasser 200 caractères.",
)
  .transform((value) =>
    value && !/^https?:\/\//i.test(value) ? `https://${value}` : value,
  )
  .refine(
    (value) => value === null || websiteHost(value) !== null,
    "Saisissez l'adresse d'un site web (ex. www.mon-hotel.fr).",
  )

const displayName = optionalText(
  150,
  "Le nom d'usage ne doit pas dépasser 150 caractères.",
)

// Code NAF rév. 2 (« 55.10Z ») ; certaines entreprises anciennes ont un code sans lettre.
const NAF_CODE = /^\d{2}\.\d{2}[A-Z]?$/

export const companyOnboardingSchema = z
  .object({
    legalName: requiredText(
      200,
      "Indiquez la raison sociale.",
      "La raison sociale ne doit pas dépasser 200 caractères.",
    ),
    siren: z
      .string()
      .transform(digits)
      .refine((value) => value !== "", "Indiquez le SIREN.")
      .refine(isValidSiren, "Ce numéro SIREN (9 chiffres) n'est pas valide."),
    siret: z
      .string()
      .transform((value) => digits(value) || null)
      .refine(
        (value) => value === null || isValidSiret(value),
        "Ce numéro SIRET (14 chiffres) n'est pas valide.",
      ),
    nafCode: optionalText(10, "Code NAF trop long.")
      .transform((value) => value?.toUpperCase() ?? null)
      .refine(
        (value) => value === null || NAF_CODE.test(value),
        "Le code NAF s'écrit comme « 55.10Z ».",
      ),
    nafLabel: optionalText(
      200,
      "Le libellé d'activité ne doit pas dépasser 200 caractères.",
    ),
    communeName: optionalText(
      100,
      "La commune ne doit pas dépasser 100 caractères.",
    ),
    displayName,
    website,
    jobTitle: requiredText(
      100,
      "Indiquez votre fonction.",
      "La fonction ne doit pas dépasser 100 caractères.",
    ),
    relationship: z.enum(
      memberRelationships,
      "Précisez votre lien avec l'entreprise.",
    ),
    relationshipDetails: optionalText(
      150,
      "La précision ne doit pas dépasser 150 caractères.",
    ),
    phone,
    // Contrôlée champ par champ : son erreur s'affiche avec celles des autres champs.
    certified: z
      .boolean()
      .refine(
        (value) => value,
        "Vous devez certifier être habilité·e à publier des offres pour cette entreprise.",
      ),
  })
  .superRefine((input, ctx) => {
    // Un SIRET est celui d'un établissement de l'entreprise : il commence par son SIREN.
    if (input.siret && !input.siret.startsWith(input.siren)) {
      ctx.addIssue({
        code: "custom",
        path: ["siret"],
        message: "Le SIRET doit commencer par le SIREN de l'entreprise.",
      })
    }
    if (input.relationship === "other" && !input.relationshipDetails) {
      ctx.addIssue({
        code: "custom",
        path: ["relationshipDetails"],
        message: "Précisez votre lien avec l'entreprise.",
      })
    }
  })
  // La précision n'accompagne que « autre ».
  .transform((input) => ({
    ...input,
    relationshipDetails:
      input.relationship === "other" ? input.relationshipDetails : null,
  }))

export type CompanyOnboarding = z.infer<typeof companyOnboardingSchema>

// Après l'onboarding : le SIREN ne change que par le formulaire de contact.
export const companyDetailsSchema = z.object({ displayName, website, phone })

export type CompanyDetails = z.infer<typeof companyDetailsSchema>

export const REVIEW_NOTE_MAX_LENGTH = 1000

// Décision de l'admin : un refus est toujours motivé, et ce motif est envoyé à l'employeur.
export const membershipDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("verify"), userId: z.string().min(1) }),
  z.object({
    decision: z.literal("reject"),
    userId: z.string().min(1),
    reviewNote: requiredText(
      REVIEW_NOTE_MAX_LENGTH,
      "Indiquez le motif du refus.",
      `Le motif ne doit pas dépasser ${REVIEW_NOTE_MAX_LENGTH} caractères.`,
    ),
  }),
])

export type MembershipDecision = z.infer<typeof membershipDecisionSchema>

export const COMPANY_SEARCH_MIN_LENGTH = 3
