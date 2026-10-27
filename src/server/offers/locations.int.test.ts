import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  adminOfferInputSchema,
  emptyAdminOfferFormValues,
} from "@/domain/offer-input"
import { db } from "@/lib/db"
import { companies, offers, offerLocations, user } from "@/lib/db/schema"
import { searchOffers } from "@/server/search/search-offers"
import {
  createDepositedOfferAsAdmin,
  updateDepositedOfferAsAdmin,
} from "./admin-offers"
import { upsertCollectedOffer } from "./ingest"
import { getOfferWithRelations } from "./queries"
import { toOfferDetailsData } from "@/components/offers/offer-details"

const adminId = crypto.randomUUID()
let companyId: string
const today = "2026-10-24"
const extra = {
  communeName: "Lacanau",
  communeInseeCode: "33214",
  postalCode: "33680",
  departmentCode: "33",
  locationDetails: "Au lac",
}
function input() {
  return adminOfferInputSchema({
    today,
    departmentCodes: ["74", "73", "33"],
    occupationIds: [],
    blockedDomains: [],
  }).parse({
    ...emptyAdminOfferFormValues(),
    origin: "deposited",
    companyId,
    title: "Poste dans trois lieux",
    seasonalContract: true,
    communeName: "Praz-sur-Arly",
    communeInseeCode: "74215",
    postalCode: "74120",
    departmentCode: "74",
    periodKind: "duration",
    durationValue: "3",
    durationUnit: "months",
    applyEmail: "rh@lieux.example",
    extraLocations: [
      {
        communeName: "Tignes",
        communeInseeCode: "73296",
        postalCode: "73320",
        departmentCode: "73",
        locationDetails: "Accueil",
      },
      extra,
    ],
  })
}
beforeAll(async () => {
  await db.delete(offers)
  await db.insert(user).values({
    id: adminId,
    name: "Admin lieux",
    email: `${adminId}@lieux.example`,
    role: "admin",
  })
  const [company] = await db
    .insert(companies)
    .values({ legalName: "Entreprise fictive lieux multiples" })
    .returning()
  companyId = company.id
})
beforeEach(async () => {
  await db.delete(offers).where(eq(offers.companyId, companyId))
})
afterAll(async () => {
  await db.delete(offers).where(eq(offers.companyId, companyId))
  await db.delete(companies).where(eq(companies.id, companyId))
  await db.delete(user).where(eq(user.id, adminId))
  await db.$client.end()
})

describe("lieux supplémentaires", () => {
  it("trouve le même poste par chacun de ses départements et par la région supplémentaire, une seule fois", async () => {
    const saved = await createDepositedOfferAsAdmin(adminId, input())
    if (!saved.ok) throw new Error(saved.message)
    for (const criteria of [
      { departments: ["74"] },
      { departments: ["73", "33"] },
      { regions: ["75"] },
    ]) {
      const result = await searchOffers(criteria, { today })
      expect(result.total).toBe(1)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({ id: saved.id, placesCount: 3 })
    }
    const offer = await getOfferWithRelations(saved.id)
    expect(
      toOfferDetailsData(offer!).places.map((place) => place.communeName),
    ).toEqual(["Praz-sur-Arly", "Tignes", "Lacanau"])
    expect((await searchOffers({ departments: ["85"] }, { today })).total).toBe(
      0,
    )
  })
  it("remplace la liste lors d'une modification et annule toute l'écriture si un lieu est invalide", async () => {
    const saved = await createDepositedOfferAsAdmin(adminId, input())
    if (!saved.ok) throw new Error(saved.message)
    await updateDepositedOfferAsAdmin(saved.id, {
      ...input(),
      extraLocations: [extra],
    })
    expect(
      (await getOfferWithRelations(saved.id))?.extraLocations.map(
        (place) => place.communeName,
      ),
    ).toEqual(["Lacanau"])
    await expect(
      updateDepositedOfferAsAdmin(saved.id, {
        ...input(),
        title: "Ne doit pas être enregistré",
        extraLocations: [
          { ...extra, departmentCode: "00", communeInseeCode: null },
        ],
      }),
    ).rejects.toThrow()
    expect(await getOfferWithRelations(saved.id)).toMatchObject({
      title: "Poste dans trois lieux",
      extraLocations: [{ communeName: "Lacanau" }],
    })
    await updateDepositedOfferAsAdmin(saved.id, {
      ...input(),
      extraLocations: [],
    })
    expect((await getOfferWithRelations(saved.id))?.extraLocations).toEqual([])
  })
  it("la saisie collectée enregistre et remplace les lieux dans la même transaction", async () => {
    const sourceUrl = `https://lieux.example/offres/${crypto.randomUUID()}`
    const collected = {
      ...input(),
      origin: "collected" as const,
      sourceUrl,
      sourceName: "Site officiel fictif",
    }
    const saved = await upsertCollectedOffer(collected, {
      kind: "admin",
      userId: adminId,
    })
    if (!saved.ok) throw new Error(saved.reason)
    expect(
      (await getOfferWithRelations(saved.offerId))?.extraLocations,
    ).toHaveLength(2)
    await upsertCollectedOffer(
      { ...collected, extraLocations: [extra] },
      { kind: "admin", userId: adminId },
      { offerId: saved.offerId },
    )
    expect(
      (await getOfferWithRelations(saved.offerId))?.extraLocations,
    ).toHaveLength(1)
  })
  it("protège le code INSEE, les positions et les doublons connus ; la suppression cascade", async () => {
    const saved = await createDepositedOfferAsAdmin(adminId, input())
    if (!saved.ok) throw new Error(saved.message)
    const invalid = (changes: Record<string, unknown>) =>
      db
        .insert(offerLocations)
        .values({ ...extra, offerId: saved.id, position: 3, ...changes })
    await expect(invalid({ communeInseeCode: "74001" })).rejects.toThrow()
    await expect(
      invalid({ communeInseeCode: null, position: 0 }),
    ).rejects.toThrow()
    await expect(
      invalid({ communeInseeCode: null, position: 1 }),
    ).rejects.toThrow()
    await expect(invalid({})).rejects.toThrow()
    await expect(
      invalid({ communeInseeCode: null, communeName: " " }),
    ).rejects.toThrow()
    await db.delete(offers).where(eq(offers.id, saved.id))
    expect(
      await db
        .select()
        .from(offerLocations)
        .where(eq(offerLocations.offerId, saved.id)),
    ).toEqual([])
  })
})
