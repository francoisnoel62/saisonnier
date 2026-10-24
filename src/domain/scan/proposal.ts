import type { Season } from "@/domain/offer"
import type { SalaryStatement } from "@/domain/salary"

import { extractApplication, type ScanApplication } from "./application"
import { extractConditions, type ScanConditions } from "./conditions"
import { seasonalContractEvidence } from "./contract"
import { absent, established, resolveFacts, type ProposalField } from "./field"
import {
  boundEvidence,
  boundObservations,
  boundText,
  observationLimits,
  postingObservations,
  type Evidence,
  type ExtractedPosting,
  type Observation,
} from "./observation"
import { extractPeriod, type Period } from "./period"
import { extractSalaryText } from "./salary-text"
import { extractSeason } from "./season"
import { parseSourceDate, type SourceDate } from "./source-date"
import { fold, positiveMatches, textObservations } from "./text"
import { scanIssue, uniqueIssues, type ScanIssue } from "./vocabulary"

export type ProposedCompany = { name: string; siren?: string }
export type ProposedPlace = {
  communeName?: string
  departmentCode?: string
  inseeCode?: string
  country?: string
  countryCode?: string
  postalCode?: string
}
export type ScanProposal = {
  occupationId?: string
  title: ProposalField<string>
  company: ProposalField<ProposedCompany>
  description: ProposalField<string>
  missions: ProposalField<string>
  contract: ProposalField<"seasonal" | "non_seasonal">
  season: ProposalField<Season>
  period: ProposalField<Period>
  applicationDeadline: ProposalField<SourceDate>
  locations: ProposalField<ProposedPlace[]>
  salary: ProposalField<SalaryStatement[]>
  salaryPrecision: ProposalField<string>
  conditions: ScanConditions
  conditionPrecisions: Partial<Record<keyof ScanConditions, string>>
  profile: ProposalField<string>
  organization: ProposalField<string>
  practicalInfo: ProposalField<string>
  application: ProposalField<ScanApplication>
  officialUrl: ProposalField<string>
  sourceDate: ProposalField<SourceDate>
  additionalInfo: ProposalField<string>
  activity: ProposalField<"active" | "closed">
  fieldsToConfirm: string[]
  issues: ScanIssue[]
  multiplePositions: boolean
  associationsExplicit: boolean
  detailReadable: boolean
}
export type ProposalRules = { referenceDate: string; timeZone?: string }
function textField(observations: readonly Observation[], name: string) {
  return resolveFacts(
    textObservations(observations, [name])
      .filter((observation) => observation.value.trim())
      .map((observation) => ({
        value: observation.value.trim(),
        evidence: observation.evidence,
      })),
  )
}
function sourceDates(
  observations: readonly Observation[],
  fields: string[],
  timeZone?: string,
) {
  return resolveFacts(
    postingObservations(observations)
      .filter((observation) => fields.includes(observation.field))
      .flatMap((observation) => {
        let value: SourceDate | null = null
        if (typeof observation.value === "string")
          value = parseSourceDate(observation.value, { timeZone })
        else if (observation.value && typeof observation.value === "object") {
          const date = observation.value as SourceDate
          if (date.precision === "instant") value = parseSourceDate(date.at)
          if (date.precision === "day")
            value = parseSourceDate(date.date, { timeZone: date.timeZone })
        }
        return value ? [{ value, evidence: observation.evidence }] : []
      }),
  )
}
export function buildProposal(
  posting: ExtractedPosting,
  rules: ProposalRules,
): ScanProposal {
  // Le texte brut est une observation de la page, distincte de tout texte général du site.
  // Les métadonnées désignées par l'adaptateur gardent aussi leur provenance de lecture.
  const observations = boundObservations(posting.observations)
  const metadataEvidence = (excerpt: string): Evidence =>
    boundEvidence(
      posting.listing?.evidence ?? {
        kind: "listing",
        scope: "posting",
        locator: posting.discoveryUrl,
        excerpt,
      },
    )
  const add = (field: string, value: unknown, evidence: Evidence) =>
    observations.push({
      field,
      value,
      evidence,
      extractorVersion: "scan-rules-v1",
      observedAt: posting.collectedAt,
    })
  if (posting.title?.trim())
    add("title", posting.title, metadataEvidence(posting.title))
  if (posting.usefulText.trim())
    add(
      "postingText",
      boundText(posting.usefulText),
      boundEvidence({
        kind: "text",
        scope: "posting",
        locator: posting.discoveryUrl,
        excerpt: posting.usefulText,
      }),
    )
  if (posting.officialUrl)
    add(
      "officialUrl",
      posting.officialUrl,
      metadataEvidence(posting.officialUrl),
    )
  if (posting.sourceDate)
    add(
      "sourceDate",
      posting.sourceDate,
      metadataEvidence(
        posting.sourceDate.precision === "day"
          ? posting.sourceDate.date
          : posting.sourceDate.at,
      ),
    )
  const contract = seasonalContractEvidence(observations)
  const period = extractPeriod(observations, rules)
  const season = extractSeason(observations, period.field)
  const conditions = extractConditions(observations)
  const salary = extractSalaryText(observations)
  const company = resolveFacts(
    postingObservations(observations)
      .filter((observation) => observation.field === "company")
      .flatMap((observation) => {
        const value = observation.value as ProposedCompany | null
        return value && typeof value.name === "string" && value.name.trim()
          ? [{ value, evidence: observation.evidence }]
          : []
      }),
  )
  const locations = resolveFacts(
    postingObservations(observations)
      .filter((observation) => observation.field === "locations")
      .flatMap((observation) => {
        const value = observation.value
        return Array.isArray(value) &&
          value.length &&
          value.every((place) => place && typeof place === "object")
          ? [
              {
                value: value as ProposedPlace[],
                evidence: observation.evidence,
              },
            ]
          : []
      }),
  )
  const locationCandidates = postingObservations(observations).filter(
    (observation) =>
      observation.field === "locationCandidates" &&
      Array.isArray(observation.value),
  )
  const activityFacts: { value: "active" | "closed"; evidence: Evidence }[] = []
  for (const observation of textObservations(observations, [
    "activity",
    "status",
    "description",
    "postingText",
  ])) {
    const text = fold(observation.value)
    if (
      positiveMatches(
        text,
        /\b(?:poste\s+pourvu|offre\s+cloturee|n'est\s+plus\s+disponible|offre\s+expiree|recrutement\s+termine)\b/,
      ).length ||
      (observation.field === "activity" && text === "closed")
    )
      activityFacts.push({ value: "closed", evidence: observation.evidence })
    if (
      positiveMatches(
        text,
        /\b(?:poste\s+a\s+pourvoir|offre\s+active|recrutement\s+ouvert)\b/,
      ).length ||
      (observation.field === "activity" && text === "active")
    )
      activityFacts.push({ value: "active", evidence: observation.evidence })
  }
  const fieldsToConfirm = [
    ...conditions.fieldsToConfirm,
    ...(salary.field.status === "contradictory" ? ["salary"] : []),
  ]
  const description = textField(observations, "description")
  const proposal: ScanProposal = {
    title: textField(observations, "title"),
    company,
    description:
      description.status !== "absent"
        ? description
        : textField(observations, "postingText"),
    missions: textField(observations, "missions"),
    contract: contract.contradictory
      ? {
          status: "contradictory",
          values: ["seasonal", "non_seasonal"],
          evidence: contract.evidence,
        }
      : contract.status === "explicit"
        ? established("seasonal", contract.evidence)
        : contract.status === "not_seasonal"
          ? established("non_seasonal", contract.evidence)
          : contract.evidence.length
            ? { status: "to_verify", evidence: contract.evidence }
            : absent(),
    season: season.field,
    period: period.field,
    applicationDeadline: sourceDates(
      observations,
      ["applicationDeadline", "validThrough"],
      rules.timeZone,
    ),
    locations:
      locations.status === "absent" && locationCandidates.length
        ? {
            status: "to_verify",
            value: locationCandidates.flatMap(
              (observation) => observation.value as ProposedPlace[],
            ),
            evidence: locationCandidates.map(
              (observation) => observation.evidence,
            ),
          }
        : locations,
    salary: salary.field,
    salaryPrecision: salary.precision,
    conditions: conditions.fields,
    conditionPrecisions: conditions.precisions,
    profile: textField(observations, "profile"),
    organization: textField(observations, "organization"),
    practicalInfo: textField(observations, "practicalInfo"),
    application: extractApplication(posting),
    officialUrl: textField(observations, "officialUrl"),
    sourceDate: sourceDates(
      observations,
      ["sourceDate", "datePosted"],
      rules.timeZone,
    ),
    additionalInfo: textField(observations, "additionalInfo"),
    activity: resolveFacts(activityFacts),
    fieldsToConfirm,
    issues: uniqueIssues([
      ...contract.issues,
      ...period.issues,
      ...season.issues,
      ...conditions.issues,
      ...salary.issues,
      ...(Array.from(posting.usefulText).length > observationLimits.text ||
      posting.observations.length > observationLimits.observations
        ? [scanIssue("text_truncated")]
        : []),
    ]),
    multiplePositions: posting.multiplePositions ?? false,
    associationsExplicit: posting.associationsExplicit ?? false,
    detailReadable: posting.detailReadable,
  }
  for (const key of [
    "description",
    "missions",
    "salaryPrecision",
    "profile",
    "organization",
    "practicalInfo",
    "additionalInfo",
  ] as const)
    if (proposal[key].status === "contradictory")
      proposal.fieldsToConfirm.push(key)
  return proposal
}
export function proposalIssues(proposal: ScanProposal): ScanIssue[] {
  const issues = proposal.issues.map((issue) =>
    scanIssue(issue.code, issue.field),
  )
  if (proposal.title.status !== "established" || !proposal.title.value.trim())
    issues.push(scanIssue("detail_unreadable", "title"))
  if (proposal.company.status !== "established")
    issues.push(scanIssue("company"))
  if (
    proposal.contract.status !== "established" ||
    proposal.contract.value !== "seasonal"
  )
    issues.push(scanIssue("seasonal_contract"))
  if (proposal.contract.status === "contradictory")
    issues.push(scanIssue("contract_contradiction"))
  if (proposal.period.status !== "established") issues.push(scanIssue("period"))
  if (proposal.period.status === "contradictory")
    issues.push(scanIssue("period_contradiction"))
  if (proposal.season.status !== "established")
    issues.push(scanIssue("season_unknown", "season"))
  if (proposal.season.status === "contradictory")
    issues.push(scanIssue("season_contradiction"))
  if (
    proposal.locations.status !== "established" ||
    !proposal.locations.value.length ||
    proposal.locations.value.some(
      (place) =>
        !place.communeName?.trim() ||
        !place.departmentCode ||
        place.departmentCode === "20",
    )
  )
    issues.push(scanIssue("location"))
  if (proposal.officialUrl.status !== "established")
    issues.push(scanIssue("official_source"))
  if (
    proposal.activity.status !== "established" ||
    proposal.activity.value !== "active"
  )
    issues.push(scanIssue("activity"))
  if (proposal.sourceDate.status !== "established")
    issues.push(scanIssue("publication_date_unknown"))
  if (proposal.multiplePositions && !proposal.associationsExplicit)
    issues.push(scanIssue("multiple_positions"))
  if (!proposal.detailReadable) issues.push(scanIssue("detail_unreadable"))
  if (proposal.applicationDeadline.status === "contradictory")
    issues.push(scanIssue("activity", "applicationDeadline"))
  for (const field of [
    "description",
    "missions",
    "salary",
    "salaryPrecision",
    "profile",
    "organization",
    "practicalInfo",
    "additionalInfo",
  ] as const)
    if (proposal[field].status === "contradictory")
      issues.push(scanIssue("optional_contradiction", field))
  for (const field of proposal.fieldsToConfirm)
    issues.push(scanIssue("optional_contradiction", field))
  for (const [field, condition] of Object.entries(proposal.conditions))
    if (condition.status === "contradictory")
      issues.push(scanIssue("optional_contradiction", field))
  return uniqueIssues(issues)
}
