import { describe, expect, it } from "vitest"

import { matchesCriteria, type MatchableOffer } from "./offer-matching"
import type { SearchCriteria } from "./search-criteria"
import { triStates } from "./tri-state"

const today = "2026-10-21"

// Offre publiée, saison d'hiver en Savoie (région 84), qui satisfait tous les critères ci-dessous.
const base: MatchableOffer = {
  status: "published",
  occupationSlug: "serveur",
  departmentCode: "73",
  regionCode: "84",
  startDate: "2026-12-01",
  endDate: "2027-04-15",
  salaryNetMinCents: 185000,
  salaryNetUnit: "month",
  housing: "yes",
  meals: "yes",
  experienceRequired: "no",
  languagesRequired: "no",
  languages: [],
  drivingLicenseRequired: "no",
  workTime: "full_time",
  couplesWelcome: "yes",
  petsAllowed: "yes",
}

function matches(fields: Partial<MatchableOffer>, criteria: SearchCriteria) {
  return matchesCriteria({ ...base, ...fields }, criteria, today)
}

describe("matchesCriteria — règles générales", () => {
  it("sans critère, retient toute offre active", () => {
    expect(matches({}, {})).toBe(true)
  })

  it("n'impose rien avec des listes vides et des interrupteurs à false", () => {
    const criteria: SearchCriteria = {
      occupations: [],
      regions: [],
      departments: [],
      spokenLanguages: [],
      housing: false,
      meals: false,
      beginnersWelcome: false,
      noLicenseRequired: false,
      couplesWelcome: false,
      petsAllowed: false,
      flexibleDates: true,
      salaryBasis: "gross",
    }
    const unknownEverywhere: Partial<MatchableOffer> = {
      occupationSlug: null,
      startDate: null,
      endDate: null,
      salaryNetMinCents: null,
      salaryNetUnit: null,
      housing: "unknown",
      meals: "unknown",
      experienceRequired: "unknown",
      languagesRequired: "unknown",
      drivingLicenseRequired: "unknown",
      workTime: "unknown",
      couplesWelcome: "unknown",
      petsAllowed: "unknown",
    }
    expect(matches(unknownEverywhere, criteria)).toBe(true)
  })

  it.each([
    { status: "pending_review" as const },
    { status: "unpublished" as const },
    { applicationDeadline: "2026-10-20" },
    { startDate: "2026-07-01", endDate: "2026-10-20" },
  ])("écarte une offre inactive : %j", (fields) => {
    expect(matches(fields, {})).toBe(false)
  })

  it("exige tous les critères à la fois", () => {
    const criteria: SearchCriteria = { housing: true, meals: true }
    expect(matches({}, criteria)).toBe(true)
    expect(matches({ meals: "no" }, criteria)).toBe(false)
  })
})

describe("matchesCriteria — métier", () => {
  const criteria: SearchCriteria = { occupations: ["serveur", "barman"] }

  it.each([
    { occupationSlug: "serveur", expected: true },
    { occupationSlug: "barman", expected: true },
    { occupationSlug: "cuisinier", expected: false },
    // Une offre sans métier du référentiel n'en a aucun (H13).
    { occupationSlug: null, expected: false },
  ])("$occupationSlug → $expected", ({ occupationSlug, expected }) => {
    expect(matches({ occupationSlug }, criteria)).toBe(expected)
  })
})

describe("matchesCriteria — lieu", () => {
  it.each([
    { criteria: { departments: ["73"] }, expected: true },
    { criteria: { departments: ["74", "05"] }, expected: false },
    { criteria: { regions: ["84"] }, expected: true },
    { criteria: { regions: ["93"] }, expected: false },
    // Département ou région : l'un des deux suffit.
    { criteria: { regions: ["93"], departments: ["73"] }, expected: true },
    { criteria: { regions: ["84"], departments: ["06"] }, expected: true },
    { criteria: { regions: ["93"], departments: ["06"] }, expected: false },
  ])("$criteria → $expected", ({ criteria, expected }) => {
    expect(matches({}, criteria)).toBe(expected)
  })
})

describe("matchesCriteria — dates (H4)", () => {
  // Contrat du 01/12/2026 au 15/04/2027.
  describe("mode strict : le contrat tient dans la disponibilité", () => {
    it.each([
      { from: "2026-11-01", to: "2027-05-01", expected: true },
      // Bornes égales aux dates du contrat : il tient tout juste.
      { from: "2026-12-01", to: "2027-04-15", expected: true },
      { from: "2026-12-02", to: "2027-05-01", expected: false },
      { from: "2026-11-01", to: "2027-04-14", expected: false },
      // Une borne seule s'applique seule.
      { from: "2026-12-01", to: undefined, expected: true },
      { from: "2026-12-02", to: undefined, expected: false },
      { from: undefined, to: "2027-04-15", expected: true },
      { from: undefined, to: "2027-04-14", expected: false },
    ])("du $from au $to → $expected", ({ from, to, expected }) => {
      expect(matches({}, { availableFrom: from, availableTo: to })).toBe(
        expected,
      )
    })
  })

  describe("mode flexible : les périodes se chevauchent", () => {
    it.each([
      { from: "2027-01-01", to: "2027-02-01", expected: true },
      { from: "2026-11-01", to: "2026-12-15", expected: true },
      // Un seul jour en commun suffit.
      { from: "2027-04-15", to: "2027-06-01", expected: true },
      { from: "2026-11-01", to: "2026-12-01", expected: true },
      { from: "2027-04-16", to: "2027-06-01", expected: false },
      { from: "2026-11-01", to: "2026-11-30", expected: false },
      { from: "2027-04-15", to: undefined, expected: true },
      { from: "2027-04-16", to: undefined, expected: false },
      { from: undefined, to: "2026-12-01", expected: true },
      { from: undefined, to: "2026-11-30", expected: false },
    ])("du $from au $to → $expected", ({ from, to, expected }) => {
      const criteria = {
        availableFrom: from,
        availableTo: to,
        flexibleDates: true,
      }
      expect(matches({}, criteria)).toBe(expected)
    })
  })

  describe("offre sans dates précises", () => {
    const durationOnly = {
      startDate: null,
      endDate: null,
      durationValue: 4,
      durationUnit: "months" as const,
    }
    // Une date de début peut accompagner une durée sans date de fin.
    const startAndDuration = { ...durationOnly, startDate: "2026-12-01" }

    it.each([
      { name: "durée seule", fields: durationOnly },
      { name: "début et durée", fields: startAndDuration },
    ])("$name : exclue dès qu'un critère de dates est actif", ({ fields }) => {
      expect(matches(fields, {})).toBe(true)
      expect(matches(fields, { availableFrom: "2026-11-01" })).toBe(false)
      expect(matches(fields, { availableTo: "2027-06-01" })).toBe(false)
      expect(
        matches(fields, {
          availableFrom: "2026-11-01",
          availableTo: "2027-06-01",
          flexibleDates: true,
        }),
      ).toBe(false)
    })
  })
})

describe("matchesCriteria — rémunération (H5)", () => {
  it.each([
    {
      name: "net mensuel au-dessus du seuil",
      fields: {},
      min: 1800,
      expected: true,
    },
    {
      name: "net mensuel égal au seuil",
      fields: {},
      min: 1850,
      expected: true,
    },
    {
      name: "net mensuel sous le seuil",
      fields: {},
      min: 1900,
      expected: false,
    },
    {
      name: "fourchette : seule la borne basse compte",
      fields: { salaryNetMinCents: 170000, salaryNetMaxCents: 200000 },
      min: 1800,
      expected: false,
    },
    {
      name: "brut à 2 000 € contre un seuil net à 1 800 €",
      fields: {
        salaryNetMinCents: null,
        salaryNetUnit: null,
        salaryGrossMinCents: 200000,
        salaryGrossUnit: "month" as const,
      },
      min: 1800,
      expected: false,
    },
    {
      name: "salaire horaire",
      fields: { salaryNetMinCents: 1250, salaryNetUnit: "hour" as const },
      min: 10,
      expected: false,
    },
    {
      name: "salaire journalier",
      fields: { salaryNetMinCents: 18000, salaryNetUnit: "day" as const },
      min: 100,
      expected: false,
    },
    {
      name: "salaire non précisé",
      fields: { salaryNetMinCents: null, salaryNetUnit: null },
      min: 1,
      expected: false,
    },
  ])("net — $name → $expected", ({ fields, min, expected }) => {
    expect(matches(fields, { salaryBasis: "net", salaryMinMonthly: min })).toBe(
      expected,
    )
  })

  it("brut : un net, même élevé, ne répond pas à un seuil brut", () => {
    expect(matches({}, { salaryBasis: "gross", salaryMinMonthly: 1000 })).toBe(
      false,
    )
  })

  it("brut : compare le brut mensuel, même quand le net est horaire", () => {
    const fields = {
      salaryNetMinCents: 1150,
      salaryNetUnit: "hour" as const,
      salaryGrossMinCents: 190000,
      salaryGrossUnit: "month" as const,
    }
    expect(
      matches(fields, { salaryBasis: "gross", salaryMinMonthly: 1900 }),
    ).toBe(true)
    expect(
      matches(fields, { salaryBasis: "gross", salaryMinMonthly: 1901 }),
    ).toBe(false)
    expect(matches(fields, { salaryBasis: "net", salaryMinMonthly: 1 })).toBe(
      false,
    )
  })

  it("la base seule, sans minimum, ne restreint rien", () => {
    expect(matches({}, { salaryBasis: "gross" })).toBe(true)
  })
})

describe("matchesCriteria — interrupteurs tri-état", () => {
  // Pour chaque interrupteur : la seule réponse qui le satisfait. « Non précisé » n'en est jamais une.
  const switches = [
    { criterion: "housing", field: "housing", accepted: "yes" },
    { criterion: "meals", field: "meals", accepted: "yes" },
    {
      criterion: "beginnersWelcome",
      field: "experienceRequired",
      accepted: "no",
    },
    {
      criterion: "noLicenseRequired",
      field: "drivingLicenseRequired",
      accepted: "no",
    },
    { criterion: "couplesWelcome", field: "couplesWelcome", accepted: "yes" },
    { criterion: "petsAllowed", field: "petsAllowed", accepted: "yes" },
  ] as const

  it.each(
    switches.flatMap(({ criterion, field, accepted }) =>
      triStates.map((value) => ({
        criterion,
        field,
        value,
        expected: value === accepted,
      })),
    ),
  )(
    "$criterion avec $field = $value → $expected",
    ({ criterion, field, value, expected }) => {
      expect(matches({ [field]: value }, { [criterion]: true })).toBe(expected)
    },
  )

  it.each(switches)(
    "$criterion : un champ absent vaut « Non précisé »",
    ({ criterion, field }) => {
      expect(matches({ [field]: undefined }, { [criterion]: true })).toBe(false)
    },
  )
})

describe("matchesCriteria — langues (H6)", () => {
  const spoken: SearchCriteria = { spokenLanguages: ["en", "it"] }

  it.each([
    {
      name: "aucune langue exigée",
      required: "no",
      languages: [],
      expected: true,
    },
    {
      name: "langue exigée parlée",
      required: "yes",
      languages: ["en"],
      expected: true,
    },
    {
      name: "toutes les langues exigées parlées",
      required: "yes",
      languages: ["en", "it"],
      expected: true,
    },
    {
      name: "une langue exigée non parlée",
      required: "yes",
      languages: ["en", "de"],
      expected: false,
    },
    {
      name: "exigence non précisée",
      required: "unknown",
      languages: [],
      expected: false,
    },
  ] as const)("$name → $expected", ({ required, languages, expected }) => {
    expect(
      matches(
        { languagesRequired: required, languages: [...languages] },
        spoken,
      ),
    ).toBe(expected)
  })
})

describe("matchesCriteria — temps de travail (H7)", () => {
  it.each([
    { workTime: "full_time", criterion: "full_time", expected: true },
    { workTime: "part_time", criterion: "full_time", expected: false },
    { workTime: "unknown", criterion: "full_time", expected: false },
    { workTime: "part_time", criterion: "part_time", expected: true },
    { workTime: "full_time", criterion: "part_time", expected: false },
    { workTime: "unknown", criterion: "part_time", expected: false },
  ] as const)(
    "$workTime pour $criterion → $expected",
    ({ workTime, criterion, expected }) => {
      expect(matches({ workTime }, { workTime: criterion })).toBe(expected)
    },
  )
})
