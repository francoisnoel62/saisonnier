import { site } from "@/config/site"

import type { ApplicationChannel } from "./offer"

// Mode de candidature et identité publique de l'entreprise (§3, §7).

export const CONFIDENTIAL_COMPANY_NAME = "Entreprise confidentielle"

export type CompanyIdentity = {
  legalName: string
  displayName?: string | null
}

export type PublicIdentityFields = {
  hideCompanyIdentity: boolean
  company: CompanyIdentity
}

// Nom montré aux candidats : l'enseigne, sinon la raison sociale. L'anonymat, réservé au canal
// chargé de recrutement, masque les deux ; l'identité reste connue du service.
export function publicCompanyName(offer: PublicIdentityFields) {
  if (offer.hideCompanyIdentity) return CONFIDENTIAL_COMPANY_NAME
  return offer.company.displayName?.trim() || offer.company.legalName
}

export type ApplicationFields = PublicIdentityFields & {
  applicationChannel: ApplicationChannel
  applyEmail?: string | null
  applyPhone?: string | null
  applyUrl?: string | null
  recruiterName?: string | null
}

const filled = (value: string | null | undefined) => !!value?.trim()

// Comment candidater, en une phrase affichée sur chaque annonce (§7).
export function applicationModeExplanation(offer: ApplicationFields) {
  const direct = [
    filled(offer.applyEmail) && "email",
    filled(offer.applyPhone) && "téléphone",
  ].filter((means) => means !== false)
  const hasUrl = filled(offer.applyUrl)

  if (offer.applicationChannel === "recruiter") {
    const means = direct.length > 0 ? ` par ${direct.join(" ou ")}` : ""
    const name = offer.recruiterName?.trim()
    const recruiter = name
      ? `${name}, chargé·e de recrutement chez ${site.name}`
      : `la personne chargée du recrutement chez ${site.name}`
    const company = offer.hideCompanyIdentity
      ? "d'une entreprise qui souhaite rester confidentielle"
      : `de l'entreprise ${publicCompanyName(offer)}`
    return `Candidature à adresser${means} à ${recruiter}, pour le compte ${company}. Vous envoyez vous-même votre CV.`
  }

  if (direct.length === 0) {
    return hasUrl
      ? "Candidature sur le site officiel de l'employeur."
      : "Candidature directe auprès de l'employeur."
  }
  const means = hasUrl
    ? `par ${direct.join(", ")} ou sur son site officiel`
    : `par ${direct.join(" ou ")}`
  return `Candidature directe auprès de l'employeur ${means}. Vous envoyez vous-même votre CV.`
}
