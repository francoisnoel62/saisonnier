import { describe, expect, it } from "vitest"

import {
  contractPeriod,
  durationLabel,
  formatIsoDate,
  offerCountLabel,
} from "./offer-display"

// Les nombres utilisent des espaces insécables ; on les compare ici à des espaces simples.
const plain = (text: string) => text.replace(/\s/g, " ")

describe("formatIsoDate", () => {
  it("écrit la date en français, sans décalage de fuseau", () => {
    expect(formatIsoDate("2026-08-10")).toBe("10 août 2026")
    expect(formatIsoDate("2027-01-01")).toBe("1 janvier 2027")
    expect(formatIsoDate("2026-12-31")).toBe("31 décembre 2026")
  })

  it("refuse une date mal formée", () => {
    expect(() => formatIsoDate("2026-08-10T00:00:00Z")).toThrow()
  })
})

describe("durationLabel", () => {
  it("accorde les semaines, pas les mois", () => {
    expect(durationLabel(1, "weeks")).toBe("1 semaine")
    expect(durationLabel(6, "weeks")).toBe("6 semaines")
    expect(durationLabel(1, "months")).toBe("1 mois")
    expect(durationLabel(5, "months")).toBe("5 mois")
  })
})

describe("contractPeriod", () => {
  it("donne les dates précises quand elles existent", () => {
    expect(
      contractPeriod({
        startDate: "2026-12-01",
        endDate: "2027-04-15",
        durationValue: 4,
        durationUnit: "months",
      }),
    ).toBe("Du 1 décembre 2026 au 15 avril 2027")
  })

  it("donne la durée seule", () => {
    expect(contractPeriod({ durationValue: 5, durationUnit: "months" })).toBe(
      "5 mois",
    )
  })

  it("complète la durée de la date connue", () => {
    expect(
      contractPeriod({
        startDate: "2027-06-15",
        durationValue: 10,
        durationUnit: "weeks",
      }),
    ).toBe("10 semaines, à partir du 15 juin 2027")
    expect(
      contractPeriod({
        endDate: "2027-09-01",
        durationValue: 2,
        durationUnit: "months",
      }),
    ).toBe("2 mois, jusqu'au 1 septembre 2027")
  })

  it("n'invente pas de période absente", () => {
    expect(contractPeriod({})).toBe("Période non précisée")
  })
})

describe("offerCountLabel", () => {
  it("accorde le nombre d'offres", () => {
    expect(offerCountLabel(0)).toBe("Aucune offre")
    expect(offerCountLabel(1)).toBe("1 offre")
    expect(offerCountLabel(42)).toBe("42 offres")
    expect(plain(offerCountLabel(1234))).toBe("1 234 offres")
  })
})
