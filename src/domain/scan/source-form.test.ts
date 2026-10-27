import { describe, expect, it } from "vitest"

import { franceTravailSearchUrl as sh17SearchUrl } from "@/domain/scan/france-travail"
import { testScanSourceDefinitions, toSnapshot } from "@/test/scan-sources"

import {
  franceTravailSearchUrl,
  parseFranceTravailSearchUrl,
} from "./france-travail-search"
import { isCompleteSnapshot } from "./source"
import {
  emptySourceFormValues,
  formValuesToSnapshot,
  revisionDiff,
  scanSourceFormSchema,
  sourceFormDefaults,
  type SourceFormValues,
} from "./source-form"
import { sourceKeyFromLabel } from "./source-key"

const context = { today: "2026-10-27" }
const schema = scanSourceFormSchema(context)
function errorsOf(values: SourceFormValues) {
  const result = schema.safeParse(values)
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."))
}

describe("recherche France Travail structurée", () => {
  it("reconstruit la recherche SH17 caractère pour caractère", () => {
    const search = parseFranceTravailSearchUrl(sh17SearchUrl)
    expect(search).toEqual({
      domaine: "G",
      emission: "3",
      lieux: "99100",
      offresPartenaires: false,
      rayon: "10",
      tri: "1",
      typeContrat: "SAI",
    })
    expect(franceTravailSearchUrl(search!)).toBe(sh17SearchUrl)
  })
  it("ajoute les mots-clés et garde les listes de codes lisibles", () => {
    expect(
      franceTravailSearchUrl({
        motsCles: "chef de rang",
        lieux: "74D,73D",
        offresPartenaires: true,
      }),
    ).toBe(
      "https://candidat.francetravail.fr/offres/recherche?lieux=74D,73D&motsCles=chef+de+rang&offresPartenaires=true&range=0-19",
    )
  })
  it.each([
    "https://candidat.francetravail.fr/offres/recherche?inconnu=1",
    "https://candidat.francetravail.fr/offres/emploi?domaine=G",
    "https://www.francetravail.fr/offres/recherche?domaine=G",
    "https://candidat.francetravail.fr/offres/recherche?domaine=G&domaine=H",
  ])("refuse une recherche qu'elle ne saurait reconstruire : %s", (url) => {
    expect(parseFranceTravailSearchUrl(url)).toBeNull()
  })
})

describe("clé d'une source", () => {
  it.each([
    ["Belambra", [], "belambra"],
    ["Pierre & Vacances – Center Parcs", [], "pierre-et-vacances-center-parcs"],
    ["Évasion Été", [], "evasion-ete"],
    ["123 Loisirs", [], "source-123-loisirs"],
    ["Belambra", ["belambra"], "belambra-2"],
    ["Belambra", ["belambra", "belambra-2"], "belambra-3"],
    ["!!!", [], "source"],
    ["a".repeat(80), [], "a".repeat(44)],
  ])("%s → %s", (label, taken, key) => {
    expect(sourceKeyFromLabel(label, taken as string[])).toBe(key)
  })
})

describe("formulaire et instantané", () => {
  it.each(["france-travail", "belambra", "vvf", "ms-vacances"])(
    "les valeurs d'une source migrée reproduisent sa version : %s",
    (key) => {
      const snapshot = toSnapshot(testScanSourceDefinitions()[key])
      const values = sourceFormDefaults(snapshot)
      const parsed = schema.parse(values)
      expect(parsed.snapshot).toEqual(snapshot)
      expect(revisionDiff(snapshot, parsed.snapshot)).toEqual([])
      expect(isCompleteSnapshot(parsed.snapshot)).toBe(true)
    },
  )
  it("un brouillon n'exige que son libellé", () => {
    const values = { ...emptySourceFormValues(), label: "Club Med" }
    expect(errorsOf(values)).toEqual([])
    expect(formValuesToSnapshot(values)).toEqual({
      label: "Club Med",
      kind: "employer",
      limits: {},
      placeAliases: {},
    })
  })
  it("une découverte n'a jamais d'employeur", () => {
    const snapshot = formValuesToSnapshot({
      ...emptySourceFormValues("discovery"),
      label: "SeasonJobs",
      employerName: "SeasonJobs",
    })
    expect(snapshot).toMatchObject({ employer: null, employerWebsite: null })
  })

  // Parité avec les CHECK de scan_sources et le schéma des versions : un cas par règle.
  const valid = sourceFormDefaults(toSnapshot(testScanSourceDefinitions().vvf))
  it.each<[string, Partial<SourceFormValues>, string]>([
    ["libellé absent (scan_sources_texts)", { label: "  " }, "label"],
    [
      "libellé trop long (scan_sources_texts)",
      { label: "x".repeat(81) },
      "label",
    ],
    [
      "SIREN invalide (scan_sources_siren)",
      { employerSiren: "123456789" },
      "employerSiren",
    ],
    [
      "site non https",
      { employerWebsite: "http://www.vvf.fr/" },
      "employerWebsite",
    ],
    ["connecteur incompatible", { adapter: "france-travail" }, "adapter"],
    ["portail sans adresse", { portalUrl: "" }, "portalUrl"],
    ["preuve incomplète", { affiliationNote: "" }, "affiliationNote"],
    [
      "consultation datée du futur",
      { reuseCheckedAt: "2027-01-01" },
      "reuseCheckedAt",
    ],
    ["limite élargie", { maxListPages: "21" }, "maxListPages"],
    ["délai raccourci", { minIntervalMs: "500" }, "minIntervalMs"],
    [
      "hôte invalide",
      { adapter: "", manualHosts: "Recrute.exemple.fr:443" },
      "manualHosts",
    ],
    ["motif trop long", { note: "x".repeat(2001) }, "note"],
    [
      "lieu connu hors de son département",
      {
        placeAliases: [
          {
            name: "Station",
            inseeCode: "38002",
            communeName: "Les Adrets",
            departmentCode: "74",
          },
        ],
      },
      "placeAliases.0.inseeCode",
    ],
    [
      "fixtures hors de l'origine de test",
      { adapter: "fixture", fixtureOrigin: "http://localhost:3101" },
      "fixtureOrigin",
    ],
  ])("%s", (_name, change, path) => {
    expect(errorsOf({ ...valid, ...change })).toContain(path)
  })
  it("la recherche France Travail signale le filtre invalide", () => {
    const values = {
      ...emptySourceFormValues("discovery"),
      label: "France Travail",
      adapter: "france-travail" as const,
      search: {
        ...emptySourceFormValues().search,
        domaine: "Z",
        offresPartenaires: false,
      },
    }
    expect(errorsOf(values)).toContain("search.domaine")
  })
  it("normalise l'adresse d'un portail à son origine", () => {
    const snapshot = formValuesToSnapshot({
      ...valid,
      portalUrl: "https://vvfrecrute.factorial.fr/",
    })
    expect(snapshot.adapterParams).toEqual({
      portalUrl: "https://vvfrecrute.factorial.fr",
    })
  })
  it("compare deux versions champ par champ", () => {
    const before = toSnapshot(testScanSourceDefinitions().vvf)
    const after = formValuesToSnapshot({
      ...sourceFormDefaults(before),
      label: "VVF Villages",
      maxListPages: "5",
    })
    expect(revisionDiff(before, after)).toEqual([
      {
        field: "label",
        label: "Libellé",
        before: "VVF",
        after: "VVF Villages",
      },
      {
        field: "limits",
        label: "Limites de lecture",
        before: {},
        after: { maxListPages: 5 },
      },
    ])
  })
})
