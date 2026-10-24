import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { publicCompanyName } from "@/domain/application"
import { findBlockedTargets } from "@/domain/blocked-domains"
import { isActive } from "@/domain/offer-activity"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import { db } from "@/lib/db"
import { blockedDomains, companies, offers } from "@/lib/db/schema"
import { demoCompanies, demoOffers, seedDemo } from "@/lib/db/seed/demo-data"

import { activeOfferConditions, getOfferWithRelations } from "./queries"

// Date figée : le jeu de démonstration et les échéances sont calculés à partir d'elle.
const today = "2026-07-01"
const demo = demoOffers(today)
const demoIds = demo.map((offer) => offer.id)

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

async function activeDemoIds(day: string) {
  const rows = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(inArray(offers.id, demoIds), activeOfferConditions(day)))
  return rows.map((row) => row.id).sort()
}

beforeAll(() => seedDemo(db, today))

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

describe("activeOfferConditions", () => {
  // Le fragment SQL et la règle isActive doivent retenir exactement les mêmes offres, y compris
  // les jours où une échéance tombe ou vient de passer.
  it.each(
    [-1, 0, 1, 2, 3, 20, 60, 120, 170, 400].map((offset) => ({
      offset,
      label: offset < 0 ? `${offset}` : `+${offset}`,
    })),
  )("retient les mêmes offres que isActive, à J$label", async ({ offset }) => {
    const day = addDays(today, offset)
    const expected = demo
      .filter((offer) => isActive(offer, day))
      .map((offer) => offer.id)
      .sort()

    expect(await activeDemoIds(day)).toEqual(expected)
  })

  it("retire les échéances dépassées, même si le job d'expiration n'a pas tourné", async () => {
    const active = await activeDemoIds(today)
    const published = demo.filter((offer) => offer.status === "published")

    expect(active).toHaveLength(36)
    expect(published.length - active.length).toBe(3)
  })

  it("refuse une date du jour mal formée", () => {
    expect(() => activeOfferConditions("2026-07-01T00:00:00.000Z")).toThrow()
  })
})

describe("getOfferWithRelations", () => {
  it("charge l'entreprise, le métier, le département et la région", async () => {
    const anonymous = demo.find((offer) => offer.hideCompanyIdentity)
    const offer = await getOfferWithRelations(anonymous!.id)

    expect(offer).toMatchObject({
      title: "Chef / cheffe de partie",
      company: { legalName: "SAS Riviera Saveurs" },
      occupation: { slug: "chef-de-partie" },
      department: {
        code: "83",
        name: "Var",
        region: { name: "Provence-Alpes-Côte d'Azur" },
      },
    })
    // Le service connaît l'entreprise ; les candidats, non.
    expect(publicCompanyName(offer!)).toBe("Entreprise confidentielle")
  })

  it("renvoie un métier nul pour une offre sans métier", async () => {
    const withoutOccupation = demo.find((offer) => !offer.occupationSlug)
    const offer = await getOfferWithRelations(withoutOccupation!.id)
    expect(offer?.occupation).toBeNull()
  })

  it("ne trouve rien pour un identifiant inconnu ou mal formé", async () => {
    expect(await getOfferWithRelations(crypto.randomUUID())).toBeUndefined()
    expect(await getOfferWithRelations("pas-un-identifiant")).toBeUndefined()
  })
})

describe("seedDemo", () => {
  it("remet le jeu à son état initial sans rien dupliquer", async () => {
    const [first] = demo
    await db
      .update(offers)
      .set({ title: "Titre modifié" })
      .where(eq(offers.id, first.id))
    await db
      .update(companies)
      .set({ displayName: "Enseigne modifiée" })
      .where(eq(companies.id, first.companyId))

    expect(await seedDemo(db, today)).toEqual({ companies: 8, offers: 43 })

    const rows = await db
      .select({ id: offers.id, title: offers.title })
      .from(offers)
      .where(inArray(offers.id, demoIds))
    expect(rows).toHaveLength(43)
    expect(rows.find((row) => row.id === first.id)?.title).toBe(first.title)
    const [company] = await db
      .select({ displayName: companies.displayName })
      .from(companies)
      .where(eq(companies.id, first.companyId))
    expect(company.displayName).toBe("Hôtel du Grand Sérac")
  })

  it("ne mène à aucun domaine exclu de la base", async () => {
    const list = (
      await db.select({ domain: blockedDomains.domain }).from(blockedDomains)
    ).map((row) => row.domain)
    expect(list.length).toBeGreaterThan(0)

    for (const offer of demo) {
      expect(findBlockedTargets(offer, list), offer.id).toEqual([])
      expect(
        checkPublicationMinimum(
          { ...offer, seasonalContractConfirmed: true },
          { origin: offer.origin, blockedDomains: list },
        ).ok,
      ).toBe(true)
    }
  })
})
