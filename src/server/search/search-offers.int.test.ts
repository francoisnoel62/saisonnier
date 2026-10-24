import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { isActive, todayInParis } from "@/domain/offer-activity"
import { matchesCriteria, type MatchableOffer } from "@/domain/offer-matching"
import {
  searchCriteriaSchema,
  type SearchCriteria,
} from "@/domain/search-criteria"
import { db } from "@/lib/db"
import { companies, departments, offers } from "@/lib/db/schema"
import {
  demoCompanies,
  demoOffers,
  seedDemo,
  type DemoOffer,
} from "@/lib/db/seed/demo-data"

import { searchOffers } from "./search-offers"

// Date figée : le jeu de démonstration et les échéances sont calculés à partir d'elle. Les contrats
// « hiver » vont d'août à janvier, les contrats « été » de janvier à juin 2027.
const today = "2026-07-01"
const demo = demoOffers(today)
const demoIds = demo.map((offer) => offer.id)

// Le jeu de démonstration, tel que l'oracle le lit : avec la région de chaque département.
let oracleOffers: (DemoOffer & MatchableOffer)[]

beforeAll(async () => {
  // La recherche porte sur toute la table : elle ne doit contenir que le jeu de démonstration
  // (une exécution E2E laisse ses propres offres dans la base de test).
  await db.delete(offers)
  await seedDemo(db, today)
  const rows = await db
    .select({ code: departments.code, regionCode: departments.regionCode })
    .from(departments)
  const regionOf = new Map(rows.map((row) => [row.code, row.regionCode]))
  oracleOffers = demo.map((offer) => ({
    ...offer,
    regionCode: regionOf.get(offer.departmentCode)!,
    extraPlaces: (offer.extraLocations ?? []).map((place) => ({
      departmentCode: place.departmentCode,
      regionCode: regionOf.get(place.departmentCode)!,
    })),
  }))
})

afterAll(async () => {
  await db.delete(offers).where(inArray(offers.id, demoIds))
  await db.delete(companies).where(
    inArray(
      companies.id,
      demoCompanies.map((company) => company.id),
    ),
  )
  await db.$client.end()
})

// Les offres de l'oracle, dans l'ordre de la recherche : publication décroissante, puis id.
function expectedIds(criteria: SearchCriteria, day = today) {
  return oracleOffers
    .filter((offer) => matchesCriteria(offer, criteria, day))
    .sort(
      (a, b) =>
        (b.sourcePublishedDate ?? todayInParis(b.publishedAt!)).localeCompare(
          a.sourcePublishedDate ?? todayInParis(a.publishedAt!),
        ) ||
        (b.sourcePublishedAt ?? b.publishedAt!).getTime() -
          (a.sourcePublishedAt ?? a.publishedAt!).getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((offer) => offer.id)
}

// Toutes les offres de la recherche, en une page.
async function searchIds(criteria: SearchCriteria, day = today) {
  const { items, total } = await searchOffers(criteria, {
    pageSize: 100,
    today: day,
  })
  expect(total).toBe(items.length)
  return items.map((item) => item.id)
}

const activeCount = demo.filter((offer) => isActive(offer, today)).length

// Chaque critère seul : il doit restreindre les résultats sans tous les écarter.
const singleCriteria: Record<string, SearchCriteria> = {
  métiers: { occupations: ["serveur", "plongeur"] },
  "un métier": { occupations: ["chef-de-partie"] },
  départements: { departments: ["73", "74"] },
  "une région": { regions: ["84"] },
  "la Corse": { regions: ["94"] },
  "région ou département": { regions: ["93"], departments: ["33"] },
  "dates strictes": { availableFrom: "2026-08-10", availableTo: "2026-12-31" },
  "dates flexibles": {
    availableFrom: "2026-08-10",
    availableTo: "2026-12-31",
    flexibleDates: true,
  },
  "début seul, strict": { availableFrom: "2027-01-20" },
  "fin seule, stricte": { availableTo: "2026-12-15" },
  "fin seule, flexible": { availableTo: "2026-08-12", flexibleDates: true },
  "début seul, flexible": { availableFrom: "2027-05-20", flexibleDates: true },
  "net mensuel ≥ 1 800 €": { salaryBasis: "net", salaryMinMonthly: 1800 },
  "net mensuel ≥ 1 500 € (borne égale)": {
    salaryBasis: "net",
    salaryMinMonthly: 1500,
  },
  "brut mensuel ≥ 2 000 €": { salaryBasis: "gross", salaryMinMonthly: 2000 },
  logement: { housing: true },
  repas: { meals: true },
  "débutants acceptés": { beginnersWelcome: true },
  anglais: { spokenLanguages: ["en"] },
  "anglais et italien": { spokenLanguages: ["en", "it"] },
  "français seul": { spokenLanguages: ["fr"] },
  "temps plein": { workTime: "full_time" },
  "temps partiel": { workTime: "part_time" },
  "permis non exigé": { noLicenseRequired: true },
  couples: { couplesWelcome: true },
  animaux: { petsAllowed: true },
}

// Critères sans effet : toutes les offres actives.
const inactiveCriteria: Record<string, SearchCriteria> = {
  "aucun critère": {},
  "listes vides": { occupations: [], regions: [], spokenLanguages: [] },
  "interrupteurs à false": { housing: false, meals: false, petsAllowed: false },
  "base de salaire sans minimum": { salaryBasis: "net" },
  "dates flexibles sans dates": { flexibleDates: true },
}

const combinations: Record<string, SearchCriteria> = {
  "logement et repas": { housing: true, meals: true },
  "Auvergne-Rhône-Alpes, logement, débutants": {
    regions: ["84"],
    housing: true,
    beginnersWelcome: true,
  },
  "printemps 2027 et net ≥ 1 600 €": {
    availableFrom: "2027-01-01",
    availableTo: "2027-05-31",
    salaryBasis: "net",
    salaryMinMonthly: 1600,
  },
  "dates flexibles, anglais, temps plein": {
    availableFrom: "2026-12-01",
    availableTo: "2027-02-10",
    flexibleDates: true,
    spokenLanguages: ["en"],
    workTime: "full_time",
  },
  "Corse et Réunion, anglais et italien": {
    departments: ["2A", "2B", "974"],
    spokenLanguages: ["en", "it"],
  },
  "service en salle, brut ≥ 1 900 €": {
    occupations: ["serveur", "barman", "chef-de-rang", "commis-de-salle"],
    salaryBasis: "gross",
    salaryMinMonthly: 1900,
  },
  "couples, animaux, logement": {
    couplesWelcome: true,
    petsAllowed: true,
    housing: true,
  },
  "sans permis, débutants, temps partiel": {
    noLicenseRequired: true,
    beginnersWelcome: true,
    workTime: "part_time",
  },
  "PACA ou Savoie, repas, temps plein": {
    regions: ["93"],
    departments: ["73"],
    meals: true,
    workTime: "full_time",
  },
  "net ≥ 2 000 €, logement et repas": {
    salaryBasis: "net",
    salaryMinMonthly: 2000,
    housing: true,
    meals: true,
  },
  "moniteur de voile, anglais, février flexible": {
    occupations: ["moniteur-de-voile"],
    spokenLanguages: ["en"],
    availableFrom: "2027-02-01",
    flexibleDates: true,
  },
  "fin avant 2027 et brut ≥ 2 000 €": {
    availableTo: "2026-12-31",
    salaryBasis: "gross",
    salaryMinMonthly: 2000,
  },
  "métier inconnu": { occupations: ["metier-inexistant"] },
  "tous les critères": {
    occupations: ["chef-de-rang", "chef-de-partie"],
    regions: ["93"],
    availableFrom: "2027-01-01",
    availableTo: "2027-06-01",
    salaryBasis: "net",
    salaryMinMonthly: 2000,
    housing: true,
    meals: true,
    spokenLanguages: ["en", "it"],
    workTime: "full_time",
  },
}

describe("searchOffers — conformité à l'oracle", () => {
  it.each(Object.entries(singleCriteria))(
    "critère seul : %s",
    async (_, criteria) => {
      const expected = expectedIds(criteria)
      expect(expected.length).toBeGreaterThan(0)
      expect(expected.length).toBeLessThan(activeCount)
      expect(await searchIds(criteria)).toEqual(expected)
    },
  )

  it.each(Object.entries(inactiveCriteria))(
    "sans restriction : %s",
    async (_, criteria) => {
      const expected = expectedIds(criteria)
      expect(expected).toHaveLength(activeCount)
      expect(await searchIds(criteria)).toEqual(expected)
    },
  )

  it.each(Object.entries(combinations))(
    "combinaison : %s",
    async (_, criteria) => {
      expect(await searchIds(criteria)).toEqual(expectedIds(criteria))
    },
  )

  it("les critères testés sont valides", () => {
    for (const criteria of [
      ...Object.values(singleCriteria),
      ...Object.values(inactiveCriteria),
      ...Object.values(combinations),
    ]) {
      expect(searchCriteriaSchema.safeParse(criteria).success).toBe(true)
    }
  })

  it("tient compte de la date du jour", async () => {
    const later = "2026-08-30"
    const criteria: SearchCriteria = { regions: ["84", "94"] }
    const expected = expectedIds(criteria, later)
    expect(expected).not.toEqual(expectedIds(criteria))
    expect(await searchIds(criteria, later)).toEqual(expected)
  })
})

describe("searchOffers — pagination", () => {
  it("découpe les résultats en pages stables, avec un total exact", async () => {
    const all = expectedIds({})
    const pageSize = 7
    const ids: string[] = []
    for (let page = 1; page <= Math.ceil(all.length / pageSize); page++) {
      const { items, total } = await searchOffers({}, { page, pageSize, today })
      expect(total).toBe(all.length)
      expect(items.length).toBeLessThanOrEqual(pageSize)
      ids.push(...items.map((item) => item.id))
    }
    expect(ids).toEqual(all)
  })

  it("renvoie une page vide au-delà de la dernière, avec le total", async () => {
    const { items, total } = await searchOffers(
      { housing: true },
      { page: 50, today },
    )
    expect(items).toEqual([])
    expect(total).toBe(expectedIds({ housing: true }).length)
  })

  it("compte 20 offres par page par défaut", async () => {
    const { items, total } = await searchOffers({}, { today })
    expect(items).toHaveLength(20)
    expect(total).toBe(activeCount)
  })

  it.each([0, -1, 1.5])("refuse la page %s", async (page) => {
    await expect(searchOffers({}, { page, today })).rejects.toThrow(RangeError)
  })
})

describe("searchOffers — carte d'offre", () => {
  it("ne renvoie que ce qu'affiche la carte", async () => {
    const { items } = await searchOffers({}, { today })
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        "id",
        "title",
        "companyName",
        "communeName",
        "department",
        "season",
        "startDate",
        "endDate",
        "durationValue",
        "durationUnit",
        "salary",
        "housing",
        "meals",
        "origin",
        "provenance",
        "externalApplication",
        "newness",
        "fieldsToConfirm",
        "placesCount",
      ].sort(),
    )
  })

  it("nomme l'entreprise publique et affiche le salaire retenu", async () => {
    const { items } = await searchOffers({}, { pageSize: 100, today })
    const byId = new Map(items.map((item) => [item.id, item]))
    const anonymous = demo.find((offer) => offer.hideCompanyIdentity)!
    const first = demo[0]

    expect(byId.get(anonymous.id)?.companyName).toBe(
      "Entreprise confidentielle",
    )
    expect(byId.get(first.id)).toMatchObject({
      title: "Réceptionniste de nuit",
      companyName: "Hôtel du Grand Sérac",
      communeName: "Val-d'Isère",
      department: { code: "73", name: "Savoie" },
      season: "winter",
      startDate: first.startDate,
      endDate: first.endDate,
      durationValue: null,
      salary: { basis: "net", unit: "month", minCents: 185000 },
      housing: "yes",
      meals: "yes",
      origin: "deposited",
    })
  })
})

describe("nouveauté et certitude", () => {
  it("range la reprise initiale à sa date source, conserve la précision et ne divulgue aucun contact", async () => {
    const { items } = await searchOffers({}, { today, pageSize: 100 })
    const old = items.find((item) =>
      item.title.includes("publication ancienne"),
    )!
    const automatic = items.find((item) =>
      item.title.includes("logement à confirmer"),
    )!
    const external = items.find((item) =>
      item.title.includes("formulaire officiel"),
    )!
    expect(items.indexOf(old)).toBeGreaterThan(items.indexOf(automatic))
    expect(old).toMatchObject({
      provenance: "human_verified",
      newness: { kind: "employer", precision: "day", date: "2026-06-10" },
    })
    expect(automatic).toMatchObject({
      provenance: "sourced",
      fieldsToConfirm: ["housing"],
      housing: "unknown",
      newness: { kind: "discovered" },
    })
    expect(external.externalApplication).toBe(true)
    const filtered = await searchOffers(
      { housing: true },
      { today, pageSize: 100 },
    )
    expect(filtered.items.some((item) => item.id === automatic.id)).toBe(false)
    expect(JSON.stringify(items)).not.toMatch(
      /applyEmail|applyPhone|applyUrl|sourceUrl|createdBy/,
    )
  })
})
