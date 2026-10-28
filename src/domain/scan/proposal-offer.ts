import {
  emptyOfferFormValues,
  offerTextLimits,
  previewOfferInput,
  weeklyHoursRange,
  type AdminOfferInput,
} from "@/domain/offer-input"

import { absent, established, valueOf } from "./field"
import type { Evidence } from "./observation"
import {
  confirmableFields,
  type ConfirmableField,
} from "@/domain/field-certainty"
import type { ScanProposal } from "./proposal"
import { dateInZone, type SourceDate } from "./source-date"

export function sourceDay(date: SourceDate) {
  return date.precision === "day"
    ? date.date
    : dateInZone(Date.parse(date.at), "Europe/Paris")
}

export function truncatePostingText(text: string, limit: number) {
  if (text.length <= limit) return text
  const prefix = text.slice(0, limit)
  const sentences = [...prefix.matchAll(/[.!?](?:\s|$)/g)]
  const end = sentences.at(-1)?.index
  if (end !== undefined) return prefix.slice(0, end + 1).trim()
  if (/\s/.test(text[limit] ?? "")) return prefix.trim()
  const lastSpace = prefix.lastIndexOf(" ")
  return (lastSpace > 0 ? prefix.slice(0, lastSpace) : prefix).trim()
}

// Textes repris d'une proposition, bornés comme les champs du formulaire admin : au-delà, la
// copie est tronquée à la phrase et la revue affiche « Contenu tronqué » (proposalFormIssues).
export const proposalTextLimits = {
  title: offerTextLimits.title,
  description: offerTextLimits.description,
  missions: offerTextLimits.missions,
  additionalInfo: 1000,
  salaryPrecision: offerTextLimits.salaryNotes,
  profile: offerTextLimits.details,
  organization: offerTextLimits.details,
  practicalInfo: offerTextLimits.otherConstraints,
} as const
// Précisions des conditions (logement, repas, permis), bornées comme les autres précisions.
export const conditionPrecisionLimit = offerTextLimits.details
export type ProposalTextField = keyof typeof proposalTextLimits

function boundedText(value: string | undefined, limit: number) {
  return value ? truncatePostingText(value, limit) : null
}
function proposalText(proposal: ScanProposal, field: ProposalTextField) {
  return boundedText(valueOf(proposal[field]), proposalTextLimits[field])
}

// La colonne et le formulaire bornent les heures hebdomadaires : au-delà, la valeur reste dans les preuves.
function plausibleWeeklyHours(hours: number | undefined) {
  return hours !== undefined &&
    hours >= weeklyHoursRange.min &&
    hours <= weeklyHoursRange.max
    ? hours
    : null
}

// Seules les valeurs établies alimentent les colonnes. Les inconnues restent absentes.
export function proposalToOfferInput(proposal: ScanProposal) {
  const period = valueOf(proposal.period)
  const places = valueOf(proposal.locations) ?? []
  const place = places[0]
  const application = valueOf(proposal.application)
  const salary = valueOf(proposal.salary) ?? []
  const net = salary.find((s) => s.basis === "net")
  const gross = salary.find((s) => s.basis === "gross")
  const deadline = valueOf(proposal.applicationDeadline)
  return {
    ...previewOfferInput(emptyOfferFormValues()),
    title: proposalText(proposal, "title") ?? "",
    occupationId: proposal.occupationId ?? null,
    description: proposalText(proposal, "description"),
    missions: proposalText(proposal, "missions"),
    season: valueOf(proposal.season) ?? null,
    startDate: period?.startDate ?? null,
    endDate: period?.endDate ?? null,
    durationValue: period?.duration?.value ?? null,
    durationUnit: period?.duration?.unit ?? null,
    applicationDeadline: deadline ? sourceDay(deadline) : null,
    communeName: place?.communeName ?? "",
    communeInseeCode: place?.inseeCode ?? null,
    departmentCode: place?.departmentCode ?? "",
    postalCode: place?.postalCode ?? null,
    extraLocations: places.slice(1).map((place) => ({
      communeName: place.communeName ?? "",
      communeInseeCode: place.inseeCode ?? null,
      departmentCode: place.departmentCode ?? "",
      postalCode: place.postalCode ?? null,
      locationDetails: null,
    })),
    salaryNetMinCents: net?.minCents ?? null,
    salaryNetMaxCents: net?.maxCents ?? null,
    salaryNetUnit: net?.unit ?? null,
    salaryGrossMinCents: gross?.minCents ?? null,
    salaryGrossMaxCents: gross?.maxCents ?? null,
    salaryGrossUnit: gross?.unit ?? null,
    salaryNotes: proposalText(proposal, "salaryPrecision"),
    housing: valueOf(proposal.conditions.housing) ?? "unknown",
    housingDetails: boundedText(
      proposal.conditionPrecisions.housing,
      conditionPrecisionLimit,
    ),
    meals: valueOf(proposal.conditions.meals) ?? "unknown",
    mealsDetails: boundedText(
      proposal.conditionPrecisions.meals,
      conditionPrecisionLimit,
    ),
    experienceRequired:
      valueOf(proposal.conditions.experienceRequired) ?? "unknown",
    experienceDetails: proposalText(proposal, "profile"),
    drivingLicenseRequired:
      valueOf(proposal.conditions.drivingLicenceRequired) ?? "unknown",
    drivingLicenseDetails: boundedText(
      proposal.conditionPrecisions.drivingLicenceRequired,
      conditionPrecisionLimit,
    ),
    workTime: valueOf(proposal.conditions.workTime) ?? "unknown",
    weeklyHours: plausibleWeeklyHours(valueOf(proposal.conditions.weeklyHours)),
    scheduleDetails: proposalText(proposal, "organization"),
    couplesWelcome: valueOf(proposal.conditions.couplesAccepted) ?? "unknown",
    petsAllowed: valueOf(proposal.conditions.petsAccepted) ?? "unknown",
    otherConstraints: proposalText(proposal, "practicalInfo"),
    additionalInfo: proposalText(proposal, "additionalInfo"),
    fieldsToConfirm: proposal.fieldsToConfirm.flatMap(
      (field): ConfirmableField[] => {
        const names: Record<string, ConfirmableField> = {
          experienceRequired: "experience",
          drivingLicenceRequired: "driving_license",
          couplesAccepted: "couples",
          petsAccepted: "pets",
          workTime: "work_time",
          languagesRequired: "languages",
        }
        const name = names[field] ?? field
        return confirmableFields.includes(name as ConfirmableField)
          ? [name as ConfirmableField]
          : []
      },
    ),
    applyEmail: application?.emails[0] ?? null,
    applyPhone: application?.phones[0] ?? null,
    applyUrl: application?.formUrl ?? null,
    sourceUrl: valueOf(proposal.officialUrl) ?? null,
    seasonalContractConfirmed: valueOf(proposal.contract) === "seasonal",
  }
}

// Une soumission validée du formulaire est une décision humaine sur les valeurs publiées.
// Les preuves originales restent sur le dossier ; cette projection ne sert qu'aux contrôles.
export function reviewedPublicationProposal(
  proposal: ScanProposal,
  input: AdminOfferInput,
  companyName: string,
): ScanProposal {
  const proof: Evidence = {
    kind: "text",
    scope: "posting",
    locator: "admin:review",
    excerpt: "Valeurs vérifiées par l'administrateur lors de la publication",
  }
  const field = <T>(value: T) => established(value, [proof])
  return {
    ...proposal,
    title: field(input.title),
    company: field({ name: companyName }),
    contract: field("seasonal"),
    season: input.season ? field(input.season) : absent(),
    period: field({
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
      ...(input.durationValue && input.durationUnit
        ? { duration: { value: input.durationValue, unit: input.durationUnit } }
        : {}),
    }),
    locations: field([
      {
        communeName: input.communeName,
        departmentCode: input.departmentCode,
        country: "France",
      },
      ...input.extraLocations.map((place) => ({
        communeName: place.communeName,
        departmentCode: place.departmentCode,
        country: "France",
      })),
    ]),
    officialUrl: field(input.sourceUrl ?? ""),
    application: field({
      emails: input.applyEmail ? [input.applyEmail] : [],
      phones: input.applyPhone ? [input.applyPhone] : [],
      ...(input.applyUrl ? { formUrl: input.applyUrl } : {}),
      generalContacts: [],
    }),
    applicationDeadline: input.applicationDeadline
      ? field({
          precision: "day",
          date: input.applicationDeadline,
          timeZone: "Europe/Paris",
        })
      : absent(),
    activity: field("active"),
    detailReadable: true,
    multiplePositions: false,
    associationsExplicit: true,
    issues: [],
    fieldsToConfirm: [],
  }
}
