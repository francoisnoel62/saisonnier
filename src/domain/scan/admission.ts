import { postingClosed } from "./activity"
import { valueOf } from "./field"
import { isFrance, isFrenchText } from "./locale"
import {
  postingObservations,
  type Evidence,
  type ExtractedPosting,
} from "./observation"
import { buildProposal, type ScanProposal } from "./proposal"
import { publicationReadiness } from "./readiness"
import { dateInZone } from "./source-date"
import { fold } from "./text"
import {
  scanIssue,
  uniqueIssues,
  type ExclusionReason,
  type ScanIssue,
  type ScanMode,
} from "./vocabulary"
import { windowDecision, type DiscoveryWindow } from "./window"

export type AdmissionContext = {
  mode: ScanMode
  window: DiscoveryWindow
  today: string
  now?: string
  testMode?: boolean
  source: {
    kind: "employer" | "discovery"
    officialHosts: readonly string[]
    postingUrlPattern?: string
    tourism?: boolean
    test?: boolean
    evidence?: Evidence
  }
  blockedDomains?: readonly string[]
}
export type AdmissionDecision =
  | { admitted: false; reason: ExclusionReason; detail: string }
  | {
      admitted: true
      proposal: ScanProposal
      blocking: ScanIssue[]
      alerts: ScanIssue[]
      signals: {
        kind: "seasonal" | "season" | "tourism_employer"
        evidence: Evidence[]
      }[]
      discoveredLabel: string
    }
export function admitPosting(
  posting: ExtractedPosting,
  context: AdmissionContext,
): AdmissionDecision {
  if (context.mode === "daily" && !context.window)
    throw new RangeError("Un passage quotidien exige sa fenêtre fixe")
  const proposal = buildProposal(posting, { referenceDate: context.today })
  const exclude = (
    reason: ExclusionReason,
    detail: string,
  ): AdmissionDecision => ({ admitted: false, reason, detail })
  let url: URL
  try {
    url = new URL(posting.discoveryUrl)
  } catch {
    return exclude("no_content", "URL de découverte inexploitable")
  }
  const example = [
    posting.discoveryUrl,
    posting.officialUrl,
    posting.formUrl?.value,
    ...posting.contacts
      .filter((contact) => contact.kind === "email")
      .map((contact) => `https://${contact.value.split("@")[1]}`),
  ]
    .filter(Boolean)
    .some((value) => {
      try {
        return new URL(value!).hostname.replace(/\.$/, "").endsWith(".example")
      } catch {
        return false
      }
    })
  if (!context.testMode && (context.source.test || example))
    return exclude("test_data", "Source ou domaine de test")
  const observations = postingObservations(posting.observations)
  const structuredNames = new Set([
    "company",
    "contract",
    "period",
    "startDate",
    "endDate",
    "duration",
    "season",
    "locations",
    "salary",
    "housing",
    "meals",
    "experienceRequired",
    "drivingLicenceRequired",
    "workTime",
    "weeklyHours",
    "couplesAccepted",
    "petsAccepted",
    "applicationDeadline",
    "validThrough",
    "activity",
    "language",
  ])
  const structuredFields = new Set(
    observations
      .filter((observation) => structuredNames.has(observation.field))
      .filter((observation) =>
        typeof observation.value !== "string"
          ? observation.value !== null && observation.value !== undefined
          : observation.value.trim().length > 0,
      )
      .map((observation) => observation.field),
  )
  const application = valueOf(proposal.application)
  if (
    application?.emails.length ||
    application?.phones.length ||
    application?.formUrl
  )
    structuredFields.add("application")
  const hasTitle =
    !!posting.title?.trim() ||
    observations.some(
      (observation) =>
        observation.field === "title" &&
        typeof observation.value === "string" &&
        observation.value.trim(),
    )
  const preciseUrl =
    url.pathname.replace(/\/+$/, "").length > 0 ||
    [...url.searchParams.keys()].some(
      (key) => !/^(?:utm_.+|gclid|fbclid|msclkid)$/i.test(key),
    )
  if (
    !hasTitle ||
    !preciseUrl ||
    (context.source.postingUrlPattern &&
      !new RegExp(context.source.postingUrlPattern).test(url.href)) ||
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    !Number.isFinite(Date.parse(posting.collectedAt)) ||
    (posting.usefulText.trim().length < 200 && structuredFields.size < 3)
  )
    return exclude(
      "no_content",
      "Intitulé, collecte ou contenu insuffisant (200 caractères ou trois champs structurés)",
    )
  if (
    postingClosed(proposal, {
      today: context.today,
      now: context.now ?? posting.collectedAt,
    })
  )
    return exclude("closed", "Clôture explicite ou échéance dépassée")
  if (
    proposal.contract.status === "established" &&
    proposal.contract.value === "non_seasonal"
  )
    return exclude("out_of_scope", "Contrat explicitement non saisonnier")
  const language = observations
    .filter(
      (observation) =>
        observation.field === "language" &&
        typeof observation.value === "string",
    )
    .map((observation) => fold(String(observation.value)))
  if (
    (language.length &&
      language.every(
        (value) => !["fr", "fra", "francais", "fr-fr"].includes(value),
      )) ||
    (!language.length &&
      (posting.usefulText.match(/\p{L}+/gu)?.length ?? 0) >= 20 &&
      !isFrenchText(posting.usefulText))
  )
    return exclude("not_french", "Texte non francophone")
  if (valueOf(proposal.locations)?.some((place) => isFrance(place) === false))
    return exclude("outside_france", "Pays explicitement hors de France")
  if (
    context.mode === "daily" &&
    windowDecision(valueOf(proposal.sourceDate), context.window) === "outside"
  )
    return exclude(
      "outside_window",
      "Date source hors de la fenêtre du passage",
    )
  const signals: Extract<AdmissionDecision, { admitted: true }>["signals"] = []
  if (
    proposal.contract.evidence.length &&
    !(
      proposal.contract.status === "established" &&
      proposal.contract.value === "non_seasonal"
    )
  )
    signals.push({ kind: "seasonal", evidence: proposal.contract.evidence })
  if (proposal.season.status === "established")
    signals.push({ kind: "season", evidence: proposal.season.evidence })
  if (
    context.source.kind === "employer" &&
    context.source.tourism &&
    context.source.evidence
  )
    signals.push({
      kind: "tourism_employer",
      evidence: [context.source.evidence],
    })
  if (!signals.length)
    return exclude(
      "out_of_scope",
      "Aucun indice documenté de pertinence saisonnière ou touristique",
    )
  const readiness = publicationReadiness(proposal, {
    today: context.today,
    now: context.now ?? posting.collectedAt,
    officialHosts: context.source.officialHosts,
    blockedDomains: context.blockedDomains ?? [],
  })
  const unknownDate = proposal.sourceDate.status !== "established"
  return {
    admitted: true,
    proposal,
    blocking: readiness.blocking,
    alerts: uniqueIssues([
      ...readiness.alerts,
      ...(unknownDate ? [scanIssue("publication_date_unknown")] : []),
    ]),
    signals,
    discoveredLabel: unknownDate
      ? `découverte le ${dateInZone(Date.parse(posting.collectedAt), "Europe/Paris")}`
      : "date de publication de la source conservée",
  }
}
