import { expect, it } from "vitest"

import {
  type ScanSourceDefinition,
  scanSourceSchema,
  validateScanSourceRegistry,
} from "@/domain/scan/source"

import { buildScanSourceDefinitions, scanSourceSummaries } from "./registry"

it("valide toutes les sources de production, sans fixture", () => {
  const sources = buildScanSourceDefinitions()
  expect(sources.fixture).toBeUndefined()
  expect(
    validateScanSourceRegistry(sources, { environment: "production" }),
  ).toEqual([])
})

it("France Travail est prioritaire et ne se substitue jamais à l'employeur", () => {
  const sources = buildScanSourceDefinitions()
  const source = sources["france-travail"]
  expect(source).toMatchObject({
    kind: "discovery",
    role: "primary",
    priority: 0,
    employer: null,
    employerWebsite: null,
  })
  expect(
    Object.values(sources)
      .filter((item) => item.role === "primary")
      .map((item) => item.key),
  ).toEqual(["france-travail"])
  expect(
    scanSourceSchema.safeParse({
      ...source,
      employer: { name: "France Travail" },
    }).success,
  ).toBe(false)
})
it("valide la seule origine locale fournie aux tests", () => {
  const policy = {
    environment: "test" as const,
    testSourceUrl: "http://localhost:3210",
  }
  expect(
    validateScanSourceRegistry(
      buildScanSourceDefinitions(policy.testSourceUrl),
      policy,
    ),
  ).toEqual([])
  expect(
    validateScanSourceRegistry(
      buildScanSourceDefinitions(policy.testSourceUrl),
      { environment: "production" },
    ),
  ).not.toEqual([])
})
// Chaque faute est isolée : un seul contrôle doit la détecter.
function errorsWith(
  change: (vvf: ScanSourceDefinition) => ScanSourceDefinition,
) {
  const sources = buildScanSourceDefinitions()
  return validateScanSourceRegistry(
    { ...sources, vvf: change(sources.vvf) },
    { environment: "production" },
  )
}
it("refuse une clé incohérente", () => {
  expect(errorsWith((vvf) => ({ ...vvf, key: "belambra" }))).toEqual([
    "vvf: clé incohérente ou dupliquée",
  ])
})
it("refuse un hôte de liste non officiel", () => {
  expect(
    errorsWith((vvf) => ({ ...vvf, officialHosts: ["wrong.example"] })),
  ).toEqual(["vvf: hôte non officiel https://vvfrecrute.factorial.fr/"])
})
it("refuse un SIREN invalide", () => {
  const errors = errorsWith((vvf) => {
    if (vvf.kind !== "employer") throw new Error("Portail employeur attendu")
    return { ...vvf, employer: { name: "VVF", siren: "123456789" } }
  })
  expect(errors).toHaveLength(1)
  expect(errors[0]).toContain("employer.siren")
})
it("refuse un alias de lieu incomplet", () => {
  const errors = errorsWith((vvf) => ({
    ...vvf,
    placeAliases: { station: { inseeCode: "", name: "", departmentCode: "" } },
  }))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toContain("placeAliases")
})
it("les alias déclarés désignent une commune complète", () => {
  expect(buildScanSourceDefinitions().vvf.placeAliases).toEqual({
    "PRAPOUTEL LES SEPT LAUX": {
      inseeCode: "38002",
      name: "Les Adrets",
      departmentCode: "38",
    },
  })
})
it("résume les sources par priorité avec leur dernière vérification", () => {
  const sources = buildScanSourceDefinitions()
  sources.vvf = {
    ...sources.vvf,
    affiliationProof: {
      ...sources.vvf.affiliationProof,
      checkedAt: "2026-10-01",
    },
  }
  const summaries = scanSourceSummaries(sources)
  expect(summaries.map((source) => source.key)).toEqual([
    "france-travail",
    "belambra",
    "vvf",
    "ms-vacances",
  ])
  expect(summaries[2].checkedAt).toBe("2026-10-23")
})
