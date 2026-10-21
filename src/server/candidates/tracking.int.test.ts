import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { isActive, todayInParis } from "@/domain/offer-activity"
import { db } from "@/lib/db"
import { companies, offers, offerTracking, user } from "@/lib/db/schema"
import { demoCompanies, demoOffers, seedDemo } from "@/lib/db/seed/demo-data"

import {
  getTrackedOffers,
  getTracking,
  OfferNotTrackableError,
  setMark,
} from "./tracking"

// Le suivi se lit au jour réel : le jeu de démonstration est daté d'aujourd'hui.
const today = todayInParis(new Date())
const demo = demoOffers(today)
const active = demo.find((offer) => isActive(offer, today))!
const inactive = demo.find((offer) => !isActive(offer, today))!
const userId = "tracking-int-test"

async function rows() {
  return db.select().from(offerTracking).where(eq(offerTracking.userId, userId))
}

beforeAll(async () => {
  await seedDemo(db, today)
  await db.delete(user).where(eq(user.id, userId))
  await db.insert(user).values({
    id: userId,
    name: "Candidat suivi",
    email: "suivi-int@e2e.test",
    emailVerified: true,
  })
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId))
  await db.delete(offers).where(
    inArray(
      offers.id,
      demo.map((offer) => offer.id),
    ),
  )
  await db.delete(companies).where(
    inArray(
      companies.id,
      demoCompanies.map((company) => company.id),
    ),
  )
  await db.$client.end()
})

describe("setMark", () => {
  it("sauvegarde une seule fois et garde la première date", async () => {
    await setMark(userId, active.id, "saved", true)
    const [first] = await rows()
    await setMark(userId, active.id, "saved", true)
    expect(await rows()).toEqual([first])
    expect(first.savedAt).not.toBeNull()
    expect(first.appliedAt).toBeNull()
  })

  it("déclare « J'ai postulé » une seule fois et garde la première date", async () => {
    await setMark(userId, active.id, "applied", true)
    const [{ appliedAt }] = await rows()
    await setMark(userId, active.id, "applied", true)
    expect((await rows())[0].appliedAt).toEqual(appliedAt)
  })

  it("retire une marque sans toucher à l'autre, puis la ligne vide", async () => {
    await setMark(userId, active.id, "saved", false)
    expect(await rows()).toMatchObject([{ savedAt: null }])
    expect((await rows())[0].appliedAt).not.toBeNull()
    await setMark(userId, active.id, "applied", false)
    expect(await rows()).toEqual([])
    // Retirer ce qui n'existe plus ne fait rien.
    await setMark(userId, active.id, "applied", false)
    await setMark(userId, "pas-un-uuid", "saved", false)
    expect(await rows()).toEqual([])
  })

  it("refuse de suivre une offre qui n'est plus active", async () => {
    await expect(
      setMark(userId, inactive.id, "saved", true),
    ).rejects.toBeInstanceOf(OfferNotTrackableError)
    await expect(
      setMark(userId, "pas-un-uuid", "applied", true),
    ).rejects.toBeInstanceOf(OfferNotTrackableError)
    expect(await rows()).toEqual([])
  })
})

describe("lecture du suivi", () => {
  it("liste les offres suivies, même devenues inactives", async () => {
    await setMark(userId, active.id, "saved", true)
    // L'offre expire après avoir été sauvegardée.
    await db
      .update(offers)
      .set({ status: "expired", expiredAt: new Date() })
      .where(eq(offers.id, active.id))

    const tracked = await getTrackedOffers(userId)
    expect(tracked).toHaveLength(1)
    expect(tracked[0]).toMatchObject({
      offer: { id: active.id, title: active.title },
      active: false,
      appliedAt: null,
    })
    expect((await getTracking(userId, [active.id])).get(active.id)).toEqual({
      savedAt: tracked[0].savedAt,
      appliedAt: null,
    })
    expect((await getTracking(userId, [inactive.id])).size).toBe(0)
  })
})
