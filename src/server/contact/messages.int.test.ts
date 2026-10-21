import { eq, like } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { isRateLimited } from "@/domain/contact"
import { db } from "@/lib/db"
import { companies, contactMessages, offers } from "@/lib/db/schema"

import { countRecentMessages, knownOfferId } from "./messages"

const domain = "@messages.int.test"
const now = new Date("2026-07-01T12:00:00Z")
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000)

function insert(email: string, createdAt: Date) {
  return db.insert(contactMessages).values({
    topic: "other",
    name: "Test",
    email,
    message: "Bonjour",
    createdAt,
  })
}

beforeEach(() =>
  db.delete(contactMessages).where(like(contactMessages.email, `%${domain}`)),
)
const companyName = "Test d'intégration du contact"

afterAll(async () => {
  await db
    .delete(contactMessages)
    .where(like(contactMessages.email, `%${domain}`))
  const testCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.legalName, companyName))
  for (const { id } of testCompanies) {
    await db.delete(offers).where(eq(offers.companyId, id))
    await db.delete(companies).where(eq(companies.id, id))
  }
  await db.$client.end()
})

describe("limitation de débit du contact", () => {
  it("ne compte que les messages de la dernière heure, pour la même adresse", async () => {
    const email = `a${domain}`
    await insert(email, minutesAgo(10))
    await insert(email, minutesAgo(59))
    await insert(email, minutesAgo(61))
    await insert(`b${domain}`, minutesAgo(5))

    expect(await countRecentMessages(email, now)).toBe(2)
  })

  it("bloque le quatrième message de l'heure", async () => {
    const email = `c${domain}`
    for (const minutes of [5, 20, 40]) await insert(email, minutesAgo(minutes))

    expect(isRateLimited(await countRecentMessages(email, now))).toBe(true)
  })

  it("refuse un message de plus de 3 000 caractères en base", async () => {
    await expect(
      db.insert(contactMessages).values({
        topic: "other",
        name: "Test",
        email: `d${domain}`,
        message: "a".repeat(3001),
      }),
    ).rejects.toThrow()
  })
})

describe("annonce rattachée au message", () => {
  it("rattache une annonce existante", async () => {
    const [company] = await db
      .insert(companies)
      .values({ legalName: companyName })
      .returning({ id: companies.id })
    const [offer] = await db
      .insert(offers)
      .values({
        origin: "collected",
        status: "published",
        publishedAt: now,
        companyId: company.id,
        title: "Serveur / serveuse",
        season: "summer",
        communeName: "Lacanau",
        departmentCode: "33",
        durationValue: 3,
        durationUnit: "months",
        applyUrl: "https://www.monhotel.example/emplois/1",
        sourceUrl: `https://www.monhotel.example/emplois/${crypto.randomUUID()}`,
        sourceCheckedAt: now,
      })
      .returning({ id: offers.id })

    expect(await knownOfferId(offer.id)).toBe(offer.id)
  })

  it("ignore une annonce inconnue, pour que le message parte quand même", async () => {
    expect(await knownOfferId(crypto.randomUUID())).toBeUndefined()
    expect(await knownOfferId(undefined)).toBeUndefined()
  })
})
