import {
  boundEvidence,
  type Evidence,
  type Observation,
} from "@/domain/scan/observation"

export function evidence(
  kind: Evidence["kind"],
  locator: string,
  excerpt: string,
  scope: Evidence["scope"] = "posting",
): Evidence {
  return boundEvidence({ kind, locator, excerpt, scope })
}
export function observed(
  field: string,
  value: unknown,
  proof: Evidence,
  extractorVersion: string,
  observedAt: string,
): Observation {
  return {
    field,
    value,
    evidence: boundEvidence(proof),
    extractorVersion,
    observedAt,
  }
}
