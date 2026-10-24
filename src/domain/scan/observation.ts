import type { SourceDate } from "./source-date"

export type Evidence = {
  kind: "jsonld" | "rss" | "html_label" | "text" | "api" | "listing"
  scope: "posting" | "site"
  locator: string
  excerpt: string
}
export type Observation<T = unknown> = {
  field: string
  value: T
  evidence: Evidence
  extractorVersion: string
  observedAt: string
}
export type ObservedContact = {
  kind: "email" | "phone"
  value: string
  role: string
  section?: string
  official: boolean
  evidence: Evidence
}
export type ExtractedPosting = {
  title?: string
  discoveryUrl: string
  officialUrl?: string
  externalId?: string
  index?: number
  collectedAt: string
  sourceDate?: SourceDate | null
  usefulText: string
  observations: Observation[]
  contacts: ObservedContact[]
  formUrl?: { value: string; official: boolean; evidence: Evidence }
  listing?: { evidence: Evidence; [key: string]: unknown }
  detailReadable: boolean
  multiplePositions?: boolean
  associationsExplicit?: boolean
}
export const observationLimits = {
  text: 20_000,
  observations: 200,
  excerpt: 300,
} as const
// Ces bornes ne modifient jamais les objets reçus. Le service conserve le signal de troncature.
export function boundText(text: string) {
  return Array.from(text).slice(0, observationLimits.text).join("")
}
export function boundEvidence(evidence: Evidence): Evidence {
  return {
    ...evidence,
    excerpt: Array.from(evidence.excerpt)
      .slice(0, observationLimits.excerpt)
      .join(""),
  }
}
export function boundObservations<T>(
  observations: readonly Observation<T>[],
): Observation<T>[] {
  return observations
    .slice(0, observationLimits.observations)
    .map((observation) => ({
      ...observation,
      evidence: boundEvidence(observation.evidence),
    }))
}
export function postingObservations(observations: readonly Observation[]) {
  return observations.filter(
    (observation) => observation.evidence.scope === "posting",
  )
}
