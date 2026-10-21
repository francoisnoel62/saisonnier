import { describe, expect, it } from "vitest"

import {
  activeCriteriaChips,
  searchSwitchLabels,
  type SearchReferentials,
  type SearchSwitch,
} from "./search-chips"
import type { SearchCriteria } from "./search-criteria"

const referentials: SearchReferentials = {
  occupations: [
    { slug: "serveur", label: "Serveur / serveuse", family: "Salle & bar" },
    { slug: "plongeur", label: "Plongeur / plongeuse", family: "Cuisine" },
  ],
  regions: [{ code: "84", name: "Auvergne-Rhône-Alpes" }],
  departments: [
    { code: "73", name: "Savoie", regionCode: "84" },
    { code: "2A", name: "Corse-du-Sud", regionCode: "94" },
  ],
}

// Les montants utilisent des espaces insécables ; on les compare ici à des espaces simples.
const plain = (text: string) => text.replace(/\s/g, " ")

const labels = (criteria: SearchCriteria) =>
  activeCriteriaChips(criteria, referentials).map((chip) => plain(chip.label))

// Tous les critères à la fois : un badge chacun, sauf ceux qui n'ont pas d'effet.
const everything: SearchCriteria = {
  occupations: ["serveur", "plongeur"],
  regions: ["84"],
  departments: ["2A"],
  availableFrom: "2026-12-01",
  availableTo: "2027-04-15",
  flexibleDates: true,
  salaryBasis: "net",
  salaryMinMonthly: 1800,
  housing: true,
  meals: true,
  beginnersWelcome: true,
  spokenLanguages: ["en", "it"],
  workTime: "full_time",
  noLicenseRequired: true,
  couplesWelcome: true,
  petsAllowed: true,
}

describe("activeCriteriaChips", () => {
  it("n'affiche rien sans critère", () => {
    expect(activeCriteriaChips({}, referentials)).toEqual([])
  })

  it("nomme chaque critère en français, dans l'ordre des filtres", () => {
    expect(labels(everything)).toEqual([
      "Serveur / serveuse",
      "Plongeur / plongeuse",
      "Auvergne-Rhône-Alpes",
      "Corse-du-Sud (2A)",
      "Disponible du 1 décembre 2026 au 15 avril 2027 (dates flexibles)",
      "Salaire net d'au moins 1 800 € / mois",
      "Logement fourni",
      "Repas fournis",
      "Débutants acceptés",
      "Je parle anglais",
      "Je parle italien",
      "Permis non exigé",
      "Temps plein",
      "Couples acceptés",
      "Animaux acceptés",
    ])
  })

  it("donne des clés uniques", () => {
    const keys = activeCriteriaChips(everything, referentials).map(
      (chip) => chip.key,
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("retire un seul critère à la fois", () => {
    for (const chip of activeCriteriaChips(everything, referentials)) {
      const remaining = activeCriteriaChips(chip.without, referentials)
      expect(remaining.map((c) => c.key)).toEqual(
        activeCriteriaChips(everything, referentials)
          .map((c) => c.key)
          .filter((key) => key !== chip.key),
      )
    }
  })

  it("retire une valeur d'une liste sans toucher aux autres", () => {
    const [serveur] = activeCriteriaChips(everything, referentials)
    expect(serveur.without).toEqual({
      ...everything,
      occupations: ["plongeur"],
    })
  })

  it("supprime la liste quand sa dernière valeur est retirée", () => {
    const [chip] = activeCriteriaChips({ departments: ["73"] }, referentials)
    expect(chip.label).toBe("Savoie (73)")
    expect(chip.without).toEqual({})
  })

  it("retire ensemble les dates et leur souplesse", () => {
    const chip = activeCriteriaChips(everything, referentials).find(
      (c) => c.key === "dates",
    )!
    expect(chip.without).not.toHaveProperty("availableFrom")
    expect(chip.without).not.toHaveProperty("availableTo")
    expect(chip.without).not.toHaveProperty("flexibleDates")
  })

  it("décrit une disponibilité ouverte d'un côté", () => {
    expect(labels({ availableFrom: "2026-12-01" })).toEqual([
      "Disponible à partir du 1 décembre 2026",
    ])
    expect(labels({ availableTo: "2027-04-15" })).toEqual([
      "Disponible jusqu'au 15 avril 2027",
    ])
  })

  it("distingue le brut du net", () => {
    expect(labels({ salaryBasis: "gross", salaryMinMonthly: 2000 })).toEqual([
      "Salaire brut d'au moins 2 000 € / mois",
    ])
  })

  it("n'affiche pas un critère sans effet", () => {
    // H5 : la base seule ne restreint rien ; des dates flexibles sans dates non plus.
    expect(labels({ salaryBasis: "net" })).toEqual([])
    expect(labels({ flexibleDates: true })).toEqual([])
    expect(labels({ housing: false })).toEqual([])
    expect(labels({ occupations: [] })).toEqual([])
  })

  it("garde une valeur inconnue du référentiel", () => {
    expect(
      labels({
        occupations: ["metier-disparu"],
        regions: ["99"],
        departments: ["98"],
        spokenLanguages: ["sv"],
      }),
    ).toEqual(["metier-disparu", "Région 99", "Département 98", "Je parle sv"])
  })

  it("reprend les libellés des interrupteurs", () => {
    for (const [field, label] of Object.entries(searchSwitchLabels)) {
      expect(labels({ [field as SearchSwitch]: true })).toEqual([label])
    }
  })
})
