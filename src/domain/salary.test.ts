import { describe, expect, it } from "vitest"

import {
  displayedSalary,
  formatSalary,
  salaryStatements,
  type SalaryFields,
  type SalaryUnit,
} from "./salary"

const net = (minCents: number, unit: SalaryUnit, maxCents?: number) => ({
  salaryNetMinCents: minCents,
  salaryNetMaxCents: maxCents ?? null,
  salaryNetUnit: unit,
})
const gross = (minCents: number, unit: SalaryUnit, maxCents?: number) => ({
  salaryGrossMinCents: minCents,
  salaryGrossMaxCents: maxCents ?? null,
  salaryGrossUnit: unit,
})
const noSalary: SalaryFields = {
  salaryNetMinCents: null,
  salaryNetMaxCents: null,
  salaryNetUnit: null,
  salaryGrossMinCents: null,
  salaryGrossMaxCents: null,
  salaryGrossUnit: null,
}

// Les montants utilisent des espaces insécables ; on les compare ici à des espaces simples.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ")

describe("salaryStatements", () => {
  it("ne renvoie rien sans salaire", () => {
    expect(salaryStatements(noSalary)).toEqual([])
    expect(salaryStatements({})).toEqual([])
  })

  it("renvoie le net puis le brut, chacun dans son unité", () => {
    expect(
      salaryStatements({
        ...noSalary,
        ...gross(1250, "hour"),
        ...net(185000, "month"),
      }),
    ).toEqual([
      { basis: "net", unit: "month", minCents: 185000 },
      { basis: "gross", unit: "hour", minCents: 1250 },
    ])
  })

  it("garde la borne haute d'une fourchette", () => {
    expect(
      salaryStatements({ ...noSalary, ...gross(180000, "month", 200000) }),
    ).toEqual([
      { basis: "gross", unit: "month", minCents: 180000, maxCents: 200000 },
    ])
  })

  it("ignore un montant sans unité ou une unité sans montant", () => {
    expect(
      salaryStatements({ salaryNetMinCents: 185000, salaryGrossUnit: "month" }),
    ).toEqual([])
  })
})

describe("displayedSalary", () => {
  it("préfère le net mensuel", () => {
    expect(
      displayedSalary({ ...gross(240000, "month"), ...net(185000, "month") }),
    ).toEqual({ basis: "net", unit: "month", minCents: 185000 })
  })

  it("sinon le brut mensuel, plutôt qu'un net horaire", () => {
    expect(
      displayedSalary({ ...net(1150, "hour"), ...gross(190000, "month") }),
    ).toEqual({
      basis: "gross",
      unit: "month",
      minCents: 190000,
    })
  })

  it("sinon le brut disponible, dans son unité", () => {
    expect(
      displayedSalary({ ...net(1000, "hour"), ...gross(1250, "hour") }),
    ).toEqual({
      basis: "gross",
      unit: "hour",
      minCents: 1250,
    })
  })

  it("sinon le net dans son unité d'origine", () => {
    expect(displayedSalary(net(1500, "hour"))).toEqual({
      basis: "net",
      unit: "hour",
      minCents: 1500,
    })
  })

  it("renvoie null sans salaire", () => {
    expect(displayedSalary(noSalary)).toBeNull()
  })
})

describe("formatSalary", () => {
  it.each([
    [
      { basis: "net", unit: "month", minCents: 185000 },
      "1 850 € net / mois (avant impôt)",
    ],
    [{ basis: "gross", unit: "hour", minCents: 1250 }, "12,50 € brut / heure"],
    [
      { basis: "gross", unit: "month", minCents: 180000, maxCents: 200000 },
      "1 800 – 2 000 € brut / mois",
    ],
    [
      { basis: "gross", unit: "hour", minCents: 1250, maxCents: 1400 },
      "12,50 – 14,00 € brut / heure",
    ],
    [
      { basis: "net", unit: "hour", minCents: 1500 },
      "15 € net / heure (avant impôt)",
    ],
    [{ basis: "gross", unit: "day", minCents: 18000 }, "180 € brut / jour"],
    [{ basis: "gross", unit: "week", minCents: 52000 }, "520 € brut / semaine"],
    [
      { basis: "gross", unit: "season", minCents: 650000 },
      "6 500 € brut / saison",
    ],
    [
      { basis: "gross", unit: "lump_sum", minCents: 150000 },
      "1 500 € brut au forfait",
    ],
    [
      { basis: "net", unit: "month", minCents: 190000, maxCents: 190000 },
      "1 900 € net / mois (avant impôt)",
    ],
  ] as const)("%j → « %s »", (statement, expected) => {
    expect(plain(formatSalary(statement))).toBe(expected)
  })

  it("garde le montant et sa devise sur la même ligne", () => {
    expect(
      formatSalary({ basis: "net", unit: "month", minCents: 185000 }),
    ).toBe("1\u202f850\u00a0€ net / mois (avant impôt)")
  })
})

describe("aucune conversion", () => {
  it("une fourchette brute horaire n'est jamais affichée comme mensuelle", () => {
    const offer = { ...noSalary, ...gross(1300, "hour", 1450) }
    const shown = displayedSalary(offer)

    expect(shown).toEqual({
      basis: "gross",
      unit: "hour",
      minCents: 1300,
      maxCents: 1450,
    })
    const text = plain(formatSalary(shown!))
    expect(text).toBe("13,00 – 14,50 € brut / heure")
    expect(text).not.toContain("mois")
    expect(text).not.toContain("net")
  })

  it("un brut n'est jamais présenté comme un net", () => {
    const text = formatSalary(displayedSalary(gross(200000, "month"))!)
    expect(text).toContain("brut")
    expect(text).not.toContain("net")
    expect(text).not.toContain("avant impôt")
  })
})
