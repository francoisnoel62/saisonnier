import { findBlockedTargets, type BlockedTarget } from "./blocked-domains"
import type {
  ApplicationChannel,
  DurationUnit,
  OfferOrigin,
  Season,
} from "./offer"

// Minimum de publication (§3). Le reste de l'annonce est facultatif : une annonce qui le satisfait
// est publiable. Les formulaires l'affichent en direct ; le serveur le vérifie avant d'enregistrer.

// Valeurs saisies, éventuellement incomplètes : un formulaire en cours de remplissage convient.
export type PublicationInput = {
  companyId?: string | null
  // Case « Il s'agit d'un contrat saisonnier », qui n'est pas enregistrée.
  seasonalContractConfirmed?: boolean
  season?: Season | null
  communeName?: string | null
  departmentCode?: string | null
  startDate?: string | null
  endDate?: string | null
  durationValue?: number | null
  durationUnit?: DurationUnit | null
  applicationChannel?: ApplicationChannel | null
  recruiterName?: string | null
  applyEmail?: string | null
  applyPhone?: string | null
  applyUrl?: string | null
  sourceUrl?: string | null
}

export type MinimumRequirement =
  | "company"
  | "seasonal_contract"
  | "location"
  | "period"
  | "application"
  | "recruiter"
  | "blocked_domain"

export type MissingItem = { requirement: MinimumRequirement; label: string }

const labels = {
  company: "Une entreprise identifiable",
  seasonal_contract:
    "Un contrat explicitement saisonnier : saison indiquée et case « contrat saisonnier » cochée",
  location: "Un lieu précis : commune et département",
  period: "Une période (dates de début et de fin) ou une durée",
  // H9 : une annonce déposée se candidate par email ou téléphone ; le lien officiel est un plus.
  application: {
    deposited: "Un moyen de candidature direct : email ou téléphone",
    collected: "Un moyen de candidature : email, téléphone ou lien officiel",
  },
  recruiter: "Le nom de la personne chargée du recrutement",
} as const

function blockedLabel({ field, domain }: BlockedTarget) {
  const advice = "indiquez un contact direct de l'entreprise."
  switch (field) {
    case "applyEmail":
      return `Les adresses @${domain} ne sont pas acceptées : ${advice}`
    case "applyUrl":
      return `Les liens vers ${domain} ne sont pas acceptés : ${advice}`
    case "sourceUrl":
      return `La source ${domain} n'est pas acceptée : seuls les sites et portails officiels des employeurs le sont.`
  }
}

// Un texte fait d'espaces n'est pas renseigné.
function filled(value: string | null | undefined): value is string {
  return !!value?.trim()
}

export function checkPublicationMinimum(
  input: PublicationInput,
  context: { origin: OfferOrigin; blockedDomains: readonly string[] },
): { ok: boolean; missing: MissingItem[] } {
  const missing: MissingItem[] = []
  const addMissing = (requirement: MinimumRequirement, label: string) =>
    missing.push({ requirement, label })

  if (!filled(input.companyId)) addMissing("company", labels.company)

  if (!input.seasonalContractConfirmed || !input.season) {
    addMissing("seasonal_contract", labels.seasonal_contract)
  }

  if (!filled(input.communeName) || !filled(input.departmentCode)) {
    addMissing("location", labels.location)
  }

  const hasPeriod = filled(input.startDate) && filled(input.endDate)
  const hasDuration =
    !!input.durationUnit &&
    input.durationValue !== null &&
    input.durationValue !== undefined &&
    input.durationValue > 0
  if (!hasPeriod && !hasDuration) addMissing("period", labels.period)

  // Un moyen qui mène à un domaine exclu ne compte pas : il est signalé à part.
  const blocked = findBlockedTargets(input, context.blockedDomains)
  const isBlocked = (field: BlockedTarget["field"]) =>
    blocked.some((target) => target.field === field)
  const email = filled(input.applyEmail) && !isBlocked("applyEmail")
  const phone = filled(input.applyPhone)
  const url = filled(input.applyUrl) && !isBlocked("applyUrl")
  const canApply =
    context.origin === "deposited" ? email || phone : email || phone || url
  if (!canApply) addMissing("application", labels.application[context.origin])

  if (
    input.applicationChannel === "recruiter" &&
    !filled(input.recruiterName)
  ) {
    addMissing("recruiter", labels.recruiter)
  }

  for (const target of blocked) {
    addMissing("blocked_domain", blockedLabel(target))
  }

  return { ok: missing.length === 0, missing }
}
