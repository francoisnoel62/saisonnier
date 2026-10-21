import { describe, expect, it } from "vitest"

import { searchCriteriaSchema } from "./search-criteria"

describe("searchCriteriaSchema", () => {
  it("accepte des critères vides", () => {
    expect(searchCriteriaSchema.parse({})).toEqual({})
  })

  it("accepte une recherche complète", () => {
    const criteria = {
      occupations: ["serveur", "chef-de-partie"],
      regions: ["84"],
      departments: ["2A", "974"],
      availableFrom: "2026-12-01",
      availableTo: "2027-04-30",
      flexibleDates: true,
      salaryBasis: "net",
      salaryMinMonthly: 1800,
      housing: true,
      meals: true,
      beginnersWelcome: true,
      spokenLanguages: ["en", "it"],
      workTime: "part_time",
      noLicenseRequired: true,
      couplesWelcome: true,
      petsAllowed: true,
    }
    expect(searchCriteriaSchema.parse(criteria)).toEqual(criteria)
  })

  it("accepte des dates de disponibilité égales", () => {
    const criteria = { availableFrom: "2026-12-01", availableTo: "2026-12-01" }
    expect(searchCriteriaSchema.safeParse(criteria).success).toBe(true)
  })

  it.each([
    { availableFrom: "2026-12-02", availableTo: "2026-12-01" },
    { availableFrom: "2026-02-30" },
    { availableTo: "2026-12-01T00:00:00.000Z" },
    // Un minimum sans base comparerait un brut à un net.
    { salaryMinMonthly: 1800 },
    { salaryBasis: "net", salaryMinMonthly: 0 },
    { salaryBasis: "net", salaryMinMonthly: 1800.5 },
    { salaryBasis: "hour" },
    // « Non précisé » n'est pas un choix de filtre.
    { workTime: "unknown" },
    { departments: ["2C"] },
    { regions: ["Auvergne"] },
    { spokenLanguages: ["EN"] },
    { occupations: ["Serveur"] },
    { occupations: Array.from({ length: 101 }, (_, i) => `metier-${i}`) },
  ])("refuse %j", (criteria) => {
    expect(searchCriteriaSchema.safeParse(criteria).success).toBe(false)
  })
})
