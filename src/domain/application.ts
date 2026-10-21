import { site } from "@/config/site"

import {
  findBlockedTargets,
  hostOf,
  type BlockedTarget,
} from "./blocked-domains"
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

// Canal « chargé de recrutement » : qui reçoit la candidature, et pour quelle entreprise (§7).
export function recruiterIntroduction(offer: ApplicationFields) {
  const name =
    offer.recruiterName?.trim() || "La personne chargée du recrutement"
  const company = offer.hideCompanyIdentity
    ? "une entreprise qui souhaite rester confidentielle"
    : publicCompanyName(offer)
  return `${name}, chargé·e de recrutement de ${site.name} pour le compte de ${company}`
}

// Lien mailto: d'une candidature : l'objet nomme l'offre et le candidat, le corps reprend le
// message d'accompagnement du dossier. Le candidat joint lui-même son CV.
export function applicationMailto({
  to,
  title,
  candidateName,
  message,
}: {
  to: string
  title: string
  candidateName: string
  message?: string | null
}) {
  const params = [
    `subject=${encodeURIComponent(`Candidature – ${title} – ${candidateName}`)}`,
    message?.trim() ? `body=${encodeURIComponent(message.trim())}` : null,
  ].filter((param) => param !== null)
  return `mailto:${to.trim()}?${params.join("&")}`
}

// Lien tel: : chiffres et « + » initial ; le « (0) » des numéros internationaux ne se compose pas.
export function telHref(phone: string) {
  const digits = phone.replace(/\(0\)/g, "").replace(/[^\d+]/g, "")
  return `tel:${digits.startsWith("+") ? "+" : ""}${digits.replace(/\+/g, "")}`
}

// Lien web ouvrable : http(s), ou une adresse sans protocole lue en https ; tout autre protocole
// (javascript:, data:…) est écarté.
function webHref(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return null
  return `https://${url}`
}

type Link = { label: string; href: string }

export type ApplicationContacts = {
  // null : moyen absent ; "unavailable" : il mène à un domaine exclu (ou n'est pas un lien web)
  // et n'est pas affiché.
  email: Link | "unavailable" | null
  phone: Link | null
  url: (Link & { domain: string }) | "unavailable" | null
  // Destinations exclues, à journaliser.
  blocked: BlockedTarget[]
}

// Coordonnées affichées à un dossier complet. Un lien ou un email dont le domaine est (ou est
// devenu) exclu n'est jamais affiché (§2, §9).
export function applicationContacts(
  offer: ApplicationFields & { title: string },
  context: {
    blockedDomains: readonly string[]
    candidateName: string
    message?: string | null
  },
): ApplicationContacts {
  const blocked = findBlockedTargets(
    { applyEmail: offer.applyEmail, applyUrl: offer.applyUrl },
    context.blockedDomains,
  )
  const isBlocked = (field: BlockedTarget["field"]) =>
    blocked.some((target) => target.field === field)

  const email = offer.applyEmail?.trim()
  const phone = offer.applyPhone?.trim()
  const url = offer.applyUrl?.trim()
  const href = url ? webHref(url) : null
  const urlDomain = href ? hostOf(href) : null

  return {
    email: !email
      ? null
      : isBlocked("applyEmail")
        ? "unavailable"
        : {
            label: email,
            href: applicationMailto({
              to: email,
              title: offer.title,
              candidateName: context.candidateName,
              message: context.message,
            }),
          },
    phone: phone ? { label: phone, href: telHref(phone) } : null,
    url: !url
      ? null
      : isBlocked("applyUrl") || !href || !urlDomain
        ? "unavailable"
        : { label: urlDomain, href, domain: urlDomain },
    blocked,
  }
}
