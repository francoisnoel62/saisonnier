import { describe, expect, it } from "vitest"

import { testScanSourceDefinitions, toSnapshot } from "@/test/scan-sources"

import {
  canMarkReady,
  qualificationGaps,
  qualificationItems,
  sampleIsRecent,
  type QualificationContext,
} from "./source-qualification"

const now = new Date("2026-10-27T10:00:00Z")
const vvf = toSnapshot(testScanSourceDefinitions().vvf)
const franceTravail = toSnapshot(testScanSourceDefinitions()["france-travail"])
const base: QualificationContext = {
  kind: "employer",
  definition: vvf,
  complete: true,
  definitionErrors: [],
  adapterAvailable: true,
  reuseDecision: "authorized",
  scheduledAccessBasis: null,
  configHash: "hash",
  lastSample: {
    at: "2026-10-26T10:00:00Z",
    configHash: "hash",
    ok: true,
    empty: false,
  },
  blockedDomains: ["indeed.fr", "francetravail.fr"],
  company: { exists: true, nafCode: "55.20Z" },
  now,
}
const state = (context: QualificationContext, code: string) =>
  qualificationItems(context).find((item) => item.code === code)

describe("qualification d'un portail employeur", () => {
  it("complète : prête, sans point manquant", () => {
    expect(qualificationGaps(qualificationItems(base))).toEqual([])
    expect(canMarkReady(qualificationItems(base))).toBe(true)
  })
  it.each<[string, Partial<QualificationContext>, string]>([
    ["connecteur indisponible", { adapterAvailable: false }, "adapter"],
    ["configuration incomplète", { complete: false }, "adapter"],
    [
      "employeur sans site",
      { definition: { ...vvf, employerWebsite: undefined } as never },
      "identity",
    ],
    [
      "sans preuve de rattachement",
      { definition: { ...vvf, affiliationProof: undefined } as never },
      "affiliation",
    ],
    [
      "conditions non consultées",
      { definition: { ...vvf, reuse: undefined } as never },
      "reuse_terms",
    ],
    ["décision à prendre", { reuseDecision: "pending" }, "reuse_decision"],
    ["reprise refusée", { reuseDecision: "refused" }, "reuse_decision"],
    ["jamais échantillonnée", { lastSample: null }, "tested"],
    [
      "échantillon d'une autre configuration",
      { lastSample: { ...base.lastSample!, configHash: "autre" } },
      "tested",
    ],
    [
      "échantillon de plus de 30 jours",
      { lastSample: { ...base.lastSample!, at: "2026-09-26T09:00:00Z" } },
      "tested",
    ],
    [
      "portail sur un domaine exclu",
      { blockedDomains: ["factorial.fr"] },
      "blocked_domains",
    ],
  ])("%s : bloquant", (_name, change, code) => {
    const items = qualificationItems({ ...base, ...change })
    expect(qualificationGaps(items).map((item) => item.code)).toEqual([code])
    expect(canMarkReady(items)).toBe(false)
  })
  it("rappelle que robots.txt n'autorise pas la reprise", () => {
    expect(state(base, "reuse_decision")?.detail).toContain("robots.txt")
  })
  it("liste vide : alerte sans blocage", () => {
    const items = qualificationItems({
      ...base,
      lastSample: { ...base.lastSample!, empty: true },
    })
    expect(items.find((item) => item.code === "tested")).toMatchObject({
      state: "alert",
    })
    expect(canMarkReady(items)).toBe(true)
  })
  it("activité hors tourisme, fiche entreprise absente, vérification ancienne : alertes", () => {
    const items = qualificationItems({
      ...base,
      company: { exists: false, nafCode: "62.01Z" },
      now: new Date("2027-06-01T00:00:00Z"),
      lastSample: { ...base.lastSample!, at: "2027-05-30T00:00:00Z" },
    })
    expect(
      items.filter((item) => item.state === "alert").map((item) => item.code),
    ).toEqual(["scope", "company", "freshness"])
    expect(canMarkReady(items)).toBe(true)
  })
})

describe("qualification d'une découverte", () => {
  const discovery: QualificationContext = {
    ...base,
    kind: "discovery",
    definition: franceTravail,
    reuseDecision: "accepted",
    company: null,
  }
  it("couverte par un domaine exclu : prête ; passages quotidiens à justifier", () => {
    const items = qualificationItems(discovery)
    expect(canMarkReady(items)).toBe(true)
    expect(
      items.find((item) => item.code === "scheduled_access"),
    ).toMatchObject({ state: "alert", blocking: false })
    expect(items.some((item) => item.code === "scope")).toBe(false)
  })
  it("un job-board non exclu doit l'être avant d'être prêt", () => {
    const items = qualificationItems({ ...discovery, blockedDomains: [] })
    expect(qualificationGaps(items)).toEqual([
      expect.objectContaining({
        code: "blocked_domains",
        detail: expect.stringContaining("candidat.francetravail.fr"),
      }),
    ])
  })
})

it("un échantillon récent porte la même empreinte, réussi, de moins de 30 jours", () => {
  const sample = { at: now, configHash: "a", ok: true, empty: false }
  expect(sampleIsRecent(sample, "a", now)).toBe(true)
  expect(sampleIsRecent({ ...sample, ok: false }, "a", now)).toBe(false)
  expect(sampleIsRecent(sample, "b", now)).toBe(false)
  expect(sampleIsRecent(null, "a", now)).toBe(false)
})
