import { expect, it } from "vitest"

import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import {
  legacyAdapterParams,
  legacyScanSourceDefinitions,
} from "@/test/scan-sources"

import {
  adapterCatalog,
  deriveSourceConfig,
  isAdapterAvailable,
  parseAdapterParams,
} from "./adapter-catalog"
import { scanAdapterKinds } from "./vocabulary"

it.each(["france-travail", "belambra", "vvf", "ms-vacances"])(
  "derive reproduit les listes, le motif et les hôtes du registre en code : %s",
  (key) => {
    const legacy = legacyScanSourceDefinitions()[key]
    expect(
      deriveSourceConfig(legacy.adapter, legacyAdapterParams[key]),
    ).toEqual({
      listUrls: legacy.listUrls,
      postingUrlPattern: legacy.postingUrlPattern,
      officialHosts: legacy.officialHosts,
    })
  },
)

it("derive reproduit la source de fixtures sur l'origine de test", () => {
  const legacy = legacyScanSourceDefinitions("http://localhost:3101").fixture
  expect(
    deriveSourceConfig("fixture", { origin: "http://localhost:3101" }),
  ).toEqual({
    listUrls: legacy.listUrls,
    postingUrlPattern: legacy.postingUrlPattern,
    officialHosts: legacy.officialHosts,
  })
})

it("le motif déduit est ancré et n'accepte que les fiches du portail", () => {
  const pattern = new RegExp(
    deriveSourceConfig("teamtailor", {
      portalUrl: "https://recrute.exemple.fr",
    })!.postingUrlPattern,
  )
  expect(pattern.test("https://recrute.exemple.fr/jobs/123-serveur")).toBe(true)
  expect(pattern.test("https://recrute.exemple.fr/jobs/serveur")).toBe(false)
  expect(pattern.test("https://recruteXexemple.fr/jobs/123-serveur")).toBe(
    false,
  )
  expect(
    pattern.test("https://evil.example/?u=https://recrute.exemple.fr/jobs/1-a"),
  ).toBe(false)
})

it.each([
  "http://recrute.exemple.fr",
  "https://recrute.exemple.fr/jobs",
  "https://recrute.exemple.fr/?ref=1",
  "https://user:secret@recrute.exemple.fr",
  "https://recrute.exemple.fr:8443",
  "recrute.exemple.fr",
])(
  "refuse une adresse de portail qui n'est pas une origine https : %s",
  (portalUrl) => {
    expect(parseAdapterParams("teamtailor", { portalUrl }).success).toBe(false)
    expect(parseAdapterParams("factorial", { portalUrl }).success).toBe(false)
    expect(deriveSourceConfig("teamtailor", { portalUrl })).toBeNull()
  },
)

it("une recherche France Travail reste sur la recherche publique, une seule pour l'instant", () => {
  expect(
    parseAdapterParams("france-travail", {
      searchUrls: [franceTravailSearchUrl],
    }).success,
  ).toBe(true)
  for (const searchUrls of [
    [],
    ["https://candidat.francetravail.fr/offres/emploi"],
    ["https://www.francetravail.fr/offres/recherche?domaine=G"],
    [franceTravailSearchUrl, franceTravailSearchUrl],
  ])
    expect(parseAdapterParams("france-travail", { searchUrls }).success).toBe(
      false,
    )
  expect(
    parseAdapterParams("france-travail", {
      searchUrls: [franceTravailSearchUrl],
      extra: true,
    }).success,
  ).toBe(false)
})

it("disponibilité : fixtures en test seulement, SmartRecruiters jamais", () => {
  expect(isAdapterAvailable("fixture", {})).toBe(false)
  expect(
    isAdapterAvailable("fixture", { testSourceUrl: "http://localhost:3101" }),
  ).toBe(true)
  expect(isAdapterAvailable("smartrecruiters", {})).toBe(false)
  expect(adapterCatalog.smartrecruiters.unavailableReason).toContain(
    "robots.txt",
  )
  expect(deriveSourceConfig("smartrecruiters", {})).toBeNull()
  for (const kind of ["teamtailor", "factorial", "france-travail"] as const)
    expect(isAdapterAvailable(kind, {})).toBe(true)
})

it("le catalogue décrit chaque valeur de l'enum scan_adapter", () => {
  expect(Object.keys(adapterCatalog).sort()).toEqual(
    [...scanAdapterKinds].sort(),
  )
  for (const kind of scanAdapterKinds)
    expect(adapterCatalog[kind].kind).toBe(kind)
})
