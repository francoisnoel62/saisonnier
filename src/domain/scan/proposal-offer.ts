import {
  emptyOfferFormValues,
  previewOfferInput,
  type AdminOfferInput,
} from "@/domain/offer-input"

import { absent, established, valueOf } from "./field"
import type { Evidence } from "./observation"
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

// Seules les valeurs établies alimentent les colonnes. Les inconnues restent absentes.
export function proposalToOfferInput(proposal: ScanProposal) {
  const period = valueOf(proposal.period)
  const place = valueOf(proposal.locations)?.[0]
  const application = valueOf(proposal.application)
  const salary = valueOf(proposal.salary) ?? []
  const net = salary.find((s) => s.basis === "net")
  const gross = salary.find((s) => s.basis === "gross")
  const deadline = valueOf(proposal.applicationDeadline)
  return {
    ...previewOfferInput(emptyOfferFormValues()),
    title: truncatePostingText(valueOf(proposal.title) ?? "", 150),
    occupationId: proposal.occupationId ?? null,
    description: valueOf(proposal.description)
      ? truncatePostingText(valueOf(proposal.description)!, 5000)
      : null,
    missions: valueOf(proposal.missions)
      ? truncatePostingText(valueOf(proposal.missions)!, 3000)
      : null,
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
    salaryNetMinCents: net?.minCents ?? null,
    salaryNetMaxCents: net?.maxCents ?? null,
    salaryNetUnit: net?.unit ?? null,
    salaryGrossMinCents: gross?.minCents ?? null,
    salaryGrossMaxCents: gross?.maxCents ?? null,
    salaryGrossUnit: gross?.unit ?? null,
    salaryNotes: valueOf(proposal.salaryPrecision) ?? null,
    housing: valueOf(proposal.conditions.housing) ?? "unknown",
    housingDetails: proposal.conditionPrecisions.housing ?? null,
    meals: valueOf(proposal.conditions.meals) ?? "unknown",
    mealsDetails: proposal.conditionPrecisions.meals ?? null,
    experienceRequired:
      valueOf(proposal.conditions.experienceRequired) ?? "unknown",
    experienceDetails: valueOf(proposal.profile) ?? null,
    drivingLicenseRequired:
      valueOf(proposal.conditions.drivingLicenceRequired) ?? "unknown",
    drivingLicenseDetails:
      proposal.conditionPrecisions.drivingLicenceRequired ?? null,
    workTime: valueOf(proposal.conditions.workTime) ?? "unknown",
    weeklyHours: valueOf(proposal.conditions.weeklyHours) ?? null,
    scheduleDetails: valueOf(proposal.organization) ?? null,
    couplesWelcome: valueOf(proposal.conditions.couplesAccepted) ?? "unknown",
    petsAllowed: valueOf(proposal.conditions.petsAccepted) ?? "unknown",
    otherConstraints: valueOf(proposal.practicalInfo) ?? null,
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
