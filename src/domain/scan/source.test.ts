import { expect, it } from "vitest"

import {
  legacyScanSourceDefinitions,
  testScanSourceDefinitions,
  toSnapshot,
} from "@/test/scan-sources"

import {
  isCompleteSnapshot,
  scanSourceDefinitionErrors,
  scanSourceDraftSnapshotSchema,
  scanSourceSnapshotSchema,
  sourceFingerprint,
  type ScanSourceDefinition,
} from "./source"

const production = { environment: "production" } as const

it("valide toutes les sources reprises du registre en code, sans fixture", () => {
  const sources = testScanSourceDefinitions()
  expect(sources.fixture).toBeUndefined()
  for (const source of Object.values(sources))
    expect(scanSourceDefinitionErrors(source, production)).toEqual([])
})

it("France Travail est prioritaire et ne se substitue jamais à l'employeur", () => {
  const sources = legacyScanSourceDefinitions()
  expect(sources["france-travail"]).toMatchObject({
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
  const snapshot = toSnapshot(testScanSourceDefinitions()["france-travail"])
  expect(
    scanSourceSnapshotSchema.safeParse({
      ...snapshot,
      employer: { name: "France Travail" },
    }).success,
  ).toBe(false)
})

it("valide la seule origine locale fournie aux tests", () => {
  const policy = {
    environment: "test" as const,
    testSourceUrl: "http://localhost:3210",
  }
  const fixture = testScanSourceDefinitions(policy.testSourceUrl).fixture
  expect(scanSourceDefinitionErrors(fixture, policy)).toEqual([])
  expect(scanSourceDefinitionErrors(fixture, production)).not.toEqual([])
  expect(
    scanSourceDefinitionErrors(fixture, {
      environment: "test",
      testSourceUrl: "http://localhost:3211",
    }),
  ).not.toEqual([])
})

// Chaque faute est isolée : un seul contrôle doit la détecter.
function errorsWith(
  change: (vvf: ScanSourceDefinition) => Record<string, unknown>,
) {
  return scanSourceDefinitionErrors(
    change(testScanSourceDefinitions().vvf),
    production,
  )
}
it("refuse une clé invalide", () => {
  expect(errorsWith((vvf) => ({ ...vvf, key: "VVF" }))).toEqual([
    "clé invalide",
  ])
})
it("refuse un hôte de liste non officiel", () => {
  expect(
    errorsWith((vvf) => ({ ...vvf, officialHosts: ["wrong.example"] })),
  ).toEqual(["hôte non officiel https://vvfrecrute.factorial.fr/"])
})
it("refuse une URL interdite", () => {
  expect(
    errorsWith((vvf) => ({ ...vvf, employerWebsite: "http://www.vvf.fr/" })),
  ).toEqual(["URL interdite http://www.vvf.fr/"])
})
it("refuse un SIREN invalide", () => {
  const errors = errorsWith((vvf) => ({
    ...vvf,
    employer: { name: "VVF", siren: "123456789" },
  }))
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
it("refuse un connecteur incompatible avec le type ou des paramètres invalides", () => {
  expect(
    errorsWith((vvf) => ({ ...vvf, adapter: "france-travail" }))[0],
  ).toContain("Connecteur incompatible")
  expect(
    errorsWith((vvf) => ({
      ...vvf,
      adapterParams: { portalUrl: "https://vvfrecrute.factorial.fr/offres" },
    }))[0],
  ).toContain("adapterParams")
})
it("refuse un texte fait d'espaces : un texte absent s'écrit NULL", () => {
  expect(errorsWith((vvf) => ({ ...vvf, label: "   " }))[0]).toContain("label")
})

it("les alias déclarés désignent une commune complète", () => {
  expect(legacyScanSourceDefinitions().vvf.placeAliases).toEqual({
    "PRAPOUTEL LES SEPT LAUX": {
      inseeCode: "38002",
      name: "Les Adrets",
      departmentCode: "38",
    },
  })
})

it("un brouillon n'exige que son identité, mais chaque champ présent reste valide", () => {
  expect(
    scanSourceDraftSnapshotSchema.safeParse({
      label: "Sandaya",
      kind: "employer",
    }).success,
  ).toBe(true)
  expect(
    scanSourceDraftSnapshotSchema.safeParse({
      label: "Sandaya",
      kind: "employer",
      officialHosts: ["Recrutement.Sandaya.jobs"],
    }).success,
  ).toBe(false)
  expect(
    scanSourceDraftSnapshotSchema.safeParse({
      label: "Indeed",
      kind: "discovery",
      employer: { name: "Indeed" },
    }).success,
  ).toBe(false)
  expect(isCompleteSnapshot({ label: "Sandaya", kind: "employer" })).toBe(false)
  expect(isCompleteSnapshot(toSnapshot(testScanSourceDefinitions().vvf))).toBe(
    true,
  )
})

it("l'empreinte ne dépend que de ce qui est lu, pas de l'ordre des clés", () => {
  const vvf = toSnapshot(testScanSourceDefinitions().vvf)
  const fingerprint = sourceFingerprint(vvf)
  expect(sourceFingerprint({ ...vvf, label: "Autre libellé" })).toBe(
    fingerprint,
  )
  expect(
    sourceFingerprint({
      ...vvf,
      affiliationProof: { ...vvf.affiliationProof, checkedAt: "2026-10-01" },
    }),
  ).toBe(fingerprint)
  expect(
    sourceFingerprint({
      officialHosts: vvf.officialHosts,
      postingUrlPattern: vvf.postingUrlPattern,
      listUrls: vvf.listUrls,
      adapterParams: vvf.adapterParams,
      adapter: vvf.adapter,
    }),
  ).toBe(fingerprint)
  expect(
    sourceFingerprint({
      ...vvf,
      listUrls: ["https://vvfrecrute.factorial.fr/x"],
    }),
  ).not.toBe(fingerprint)
  expect(sourceFingerprint({})).toBe(
    '{"adapter":null,"adapterParams":null,"listUrls":null,"officialHosts":null,"postingUrlPattern":null}',
  )
})
