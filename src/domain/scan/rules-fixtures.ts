// Données fictives communes aux tests des règles, sans accès aux sources réelles.
import type { AdmissionContext } from "./admission"
import type { Evidence, ExtractedPosting, Observation } from "./observation"
import type { ReadinessContext } from "./readiness"
import { discoveryWindow } from "./window"

export const collectedAt = "2026-10-24T10:00:00.000Z"
export const evidence: Evidence = {
  kind: "text",
  scope: "posting",
  locator: "https://hotel.example/offres/serveur",
  excerpt: "Extrait fictif de l'annonce",
}
export function observation<T>(
  value: T,
  field = "description",
  scope: Evidence["scope"] = "posting",
): Observation<T> {
  return {
    field,
    value,
    evidence: {
      ...evidence,
      scope,
      excerpt:
        typeof value === "string"
          ? value.slice(0, 300)
          : JSON.stringify(value).slice(0, 300),
    },
    extractorVersion: "fixture-v1",
    observedAt: collectedAt,
  }
}
export function posting(
  overrides: Partial<ExtractedPosting> = {},
): ExtractedPosting {
  return {
    title: "Serveur H/F - Hiver 26-27",
    detailReadable: true,
    discoveryUrl: "https://hotel.example/offres/serveur",
    officialUrl: "https://hotel.example/offres/serveur",
    collectedAt,
    sourceDate: { precision: "instant", at: "2026-10-23T08:00:00Z" },
    usefulText:
      "Nous recherchons un serveur pour notre établissement de tourisme. Nous proposons un CDD saisonnier du 15 décembre 2026 au 15 avril 2027. Le poste est à pourvoir dans notre équipe. Vous accueillez les clients et vous assurez le service des repas dans la salle de notre restaurant.",
    observations: [
      observation({ name: "Hôtel des Flocons Fictifs" }, "company"),
      observation(
        [{ communeName: "Chamonix", departmentCode: "74", country: "France" }],
        "locations",
      ),
      observation("active", "activity"),
    ],
    contacts: [
      {
        kind: "email",
        value: "recrutement@hotel.example",
        role: "recrutement",
        section: "Comment postuler",
        official: true,
        evidence,
      },
    ],
    ...overrides,
  }
}
export const admissionContext: AdmissionContext = {
  mode: "daily",
  window: discoveryWindow("daily", collectedAt),
  today: "2026-10-24",
  testMode: true,
  source: { kind: "employer", officialHosts: ["hotel.example"] },
}
export const readinessContext: ReadinessContext = {
  officialHosts: ["hotel.example"],
  blockedDomains: ["jobboard.example"],
  today: "2026-10-24",
  now: collectedAt,
}
