import { describe, expect, it } from "vitest"
import {
  provenanceOf,
  isExternalApplication,
  newnessOf,
  newnessLabel,
} from "./offer-labels"

describe("provenance", () => {
  it("distingue les quatre provenances et le compte supprimé", () => {
    expect(
      provenanceOf({ origin: "collected", humanVerifiedAt: new Date() }),
    ).toBe("human_verified")
    expect(
      provenanceOf({ origin: "collected", createdBy: { role: "employer" } }),
    ).toBe("sourced")
    expect(
      provenanceOf({ origin: "deposited", createdBy: { role: "employer" } }),
    ).toBe("verified_recruiter")
    expect(
      provenanceOf({ origin: "deposited", createdBy: { role: "admin" } }),
    ).toBe("deposited")
    expect(provenanceOf({ origin: "deposited", createdBy: null })).toBe(
      "deposited",
    )
  })
  it("le formulaire seul est indépendant de la provenance", () => {
    const form = {
      applicationChannel: "employer" as const,
      applyUrl: "https://emploi.example/formulaire",
    }
    expect(isExternalApplication(form)).toBe(true)
    expect(
      isExternalApplication({ ...form, applyEmail: "rh@emploi.example" }),
    ).toBe(false)
    expect(
      isExternalApplication({ ...form, applyPhone: "04 65 71 00 01" }),
    ).toBe(false)
    expect(
      isExternalApplication({ ...form, applicationChannel: "recruiter" }),
    ).toBe(false)
    expect(isExternalApplication({ ...form, applyUrl: null })).toBe(false)
  })
  it("un formulaire sur un domaine devenu exclu n'est plus une candidature externe (plan scan 09)", () => {
    const form = {
      applicationChannel: "employer" as const,
      applyUrl: "https://fr.jobboard.example/offre/12",
    }
    expect(isExternalApplication(form, ["jobboard.example"])).toBe(false)
    expect(isExternalApplication(form, ["autre.example"])).toBe(true)
  })
})
describe("nouveauté", () => {
  const date = new Date("2026-10-24T06:00:00Z")
  it("privilégie la date de la source sans inventer une heure", () => {
    expect(
      newnessOf({
        sourcePublishedDate: "2026-10-01",
        firstDiscoveredAt: date,
        publishedAt: date,
      }),
    ).toEqual({ kind: "employer", date: "2026-10-01", precision: "day" })
    expect(
      newnessOf({ sourcePublishedDate: "2026-10-24", sourcePublishedAt: date }),
    ).toEqual({
      kind: "employer",
      date: date.toISOString(),
      precision: "instant",
    })
  })
  it("affiche découverte puis publication sur la plateforme", () => {
    expect(
      newnessOf({ firstDiscoveredAt: date, publishedAt: date })?.kind,
    ).toBe("discovered")
    expect(newnessOf({ publishedAt: date })?.kind).toBe("platform")
    expect(newnessOf({})).toBeNull()
    expect(
      newnessLabel({ kind: "employer", date: "2026-01-01", precision: "day" }),
    ).toBe("Publiée par l'employeur le 1 janvier 2026")
  })
})
