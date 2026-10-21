import { describe, expect, it } from "vitest"

import type { SearchCriteria } from "@/domain/search-criteria"

import {
  criteriaFromValues,
  loadSearch,
  searchHref,
  valuesFromCriteria,
} from "./search-params"

const everything: SearchCriteria = {
  occupations: ["serveur", "plongeur"],
  regions: ["84"],
  departments: ["2A", "73"],
  availableFrom: "2026-12-01",
  availableTo: "2027-04-15",
  flexibleDates: true,
  salaryBasis: "gross",
  salaryMinMonthly: 2000,
  housing: true,
  meals: true,
  beginnersWelcome: true,
  spokenLanguages: ["en", "it"],
  workTime: "part_time",
  noLicenseRequired: true,
  couplesWelcome: true,
  petsAllowed: true,
}

const query = (href: string) => href.slice(href.indexOf("?"))

describe("URL ↔ critères", () => {
  it("lit une URL aux clés françaises", () => {
    expect(
      loadSearch(
        "?metier=serveur,plongeur&dept=73&du=2026-12-01&au=2027-04-15&flexible=oui&base=net&min=1800&logement=oui&langues=en&temps=plein&sanspermis=oui&page=2",
      ),
    ).toEqual({
      criteria: {
        occupations: ["serveur", "plongeur"],
        departments: ["73"],
        availableFrom: "2026-12-01",
        availableTo: "2027-04-15",
        flexibleDates: true,
        salaryBasis: "net",
        salaryMinMonthly: 1800,
        housing: true,
        spokenLanguages: ["en"],
        workTime: "full_time",
        noLicenseRequired: true,
      },
      page: 2,
    })
  })

  it("fait l'aller-retour de chaque critère", () => {
    const href = searchHref(everything, 3)
    expect(href).toMatch(/^\/offres\?/)
    expect(loadSearch(query(href))).toEqual({ criteria: everything, page: 3 })
  })

  it("fait l'aller-retour de chaque critère seul", () => {
    for (const [field, value] of Object.entries(everything)) {
      const criteria = { [field]: value } as SearchCriteria
      // Un minimum de salaire exige sa base (H5).
      if (field === "salaryMinMonthly") criteria.salaryBasis = "net"
      expect(loadSearch(query(searchHref(criteria)))).toEqual({
        criteria,
        page: 1,
      })
    }
  })

  it("n'écrit dans l'URL que les critères actifs", () => {
    expect(searchHref({})).toBe("/offres")
    expect(searchHref({ housing: false, occupations: [] }, 1)).toBe("/offres")
    expect(searchHref({ housing: true, salaryBasis: "gross" })).toBe(
      "/offres?base=brut&logement=oui",
    )
  })

  it("passe d'un état de filtres aux critères et retour", () => {
    expect(criteriaFromValues(valuesFromCriteria(everything))).toEqual(
      everything,
    )
    expect(criteriaFromValues(valuesFromCriteria({}))).toEqual({})
  })
})

describe("URL modifiée à la main", () => {
  it("ignore une valeur invalide, et seulement elle", () => {
    expect(
      loadSearch(
        "?metier=serveur,Pas%20un%20slug&dept=73,999&du=2026-02-30&base=salaire&min=-5&temps=nuit&logement=1&repas=oui&page=0",
      ),
    ).toEqual({
      criteria: { occupations: ["serveur"], departments: ["73"], meals: true },
      page: 1,
    })
  })

  it("ignore un minimum de salaire sans base (H5)", () => {
    expect(loadSearch("?min=1800").criteria).toEqual({})
  })

  it("ignore une fin de disponibilité antérieure au début", () => {
    expect(loadSearch("?du=2027-04-15&au=2026-12-01").criteria).toEqual({
      availableFrom: "2027-04-15",
    })
  })

  it("ne garde qu'une fois une valeur répétée", () => {
    expect(loadSearch("?langues=en,en,de").criteria).toEqual({
      spokenLanguages: ["en", "de"],
    })
  })

  it("lit aussi les searchParams de Next", () => {
    expect(loadSearch({ metier: "serveur", page: "4" })).toEqual({
      criteria: { occupations: ["serveur"] },
      page: 4,
    })
  })
})
