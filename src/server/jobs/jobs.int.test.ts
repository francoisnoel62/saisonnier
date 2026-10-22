import { eq, inArray } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { db } from "@/lib/db"
import {
  companies,
  offers,
  scheduledJobs,
  user,
  type NewOffer,
} from "@/lib/db/schema"
import type { Email } from "@/lib/email/send"
import { env } from "@/lib/env"
import { verifyOfferToken } from "@/lib/signed-token"

import { expireOffers } from "./expire-offers"
import {
  getScheduledJob,
  recordDailyJobRun,
  setScheduledJobEnabled,
} from "./settings"
import { sendValidityReminders } from "./validity-reminders"

// Les emails sont interceptés : le test lit ce qui serait envoyé.
const sent = vi.hoisted(() => [] as Email[])
vi.mock("@/lib/email/send", () => ({
  sendEmail: async (email: Email) => {
    sent.push(email)
  },
}))

// SIREN propre à ce fichier (clé de Luhn valide), absent du jeu de démonstration.
const SIREN = "400000006"
const DEPOSITOR = "jobs-int-depositor"
const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date("2026-10-22T03:00:00Z")
const today = "2026-10-22"
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)

let companyId: string

async function insertOffer(values: Partial<NewOffer>) {
  const [offer] = await db
    .insert(offers)
    .values({
      origin: "deposited",
      status: "published",
      companyId,
      createdByUserId: DEPOSITOR,
      title: "Serveur / serveuse",
      season: "winter",
      communeName: "Gérardmer",
      departmentCode: "88",
      durationValue: 4,
      durationUnit: "months",
      applyEmail: "rh@hotel-jobs.example",
      publishedAt: daysAgo(1),
      ...values,
    })
    .returning()
  return offer
}

async function row(id: string) {
  const [offer] = await db.select().from(offers).where(eq(offers.id, id))
  return offer
}

async function cleanUp() {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.siren, SIREN))
  const ids = rows.map((r) => r.id)
  if (ids.length > 0) {
    await db.delete(offers).where(inArray(offers.companyId, ids))
    await db.delete(companies).where(inArray(companies.id, ids))
  }
  await db.delete(scheduledJobs).where(eq(scheduledJobs.name, "daily"))
  await db.delete(user).where(eq(user.id, DEPOSITOR))
}

beforeAll(async () => {
  await cleanUp()
  await db.insert(user).values({
    id: DEPOSITOR,
    name: "Dominique Déposant",
    email: `${DEPOSITOR}@e2e.test`,
    emailVerified: true,
    role: "employer",
  })
  const [company] = await db
    .insert(companies)
    .values({ legalName: "Hôtel des Jobs", siren: SIREN })
    .returning()
  companyId = company.id
})

afterAll(async () => {
  await cleanUp()
  await db.$client.end()
})

beforeEach(() => {
  sent.length = 0
})

describe("expireOffers", () => {
  it("une date limite de candidature passée hier : l'annonce expire", async () => {
    const offer = await insertOffer({ applicationDeadline: "2026-10-21" })
    await expireOffers(today, now)
    expect(await row(offer.id)).toMatchObject({
      status: "expired",
      expiredAt: now,
    })
  })

  it("une date de fin passée : l'annonce expire ; le jour même, elle reste publiée", async () => {
    const ended = await insertOffer({
      startDate: "2026-07-01",
      endDate: "2026-10-21",
      durationValue: null,
      durationUnit: null,
    })
    const lastDay = await insertOffer({
      startDate: "2026-07-01",
      endDate: today,
      durationValue: null,
      durationUnit: null,
    })
    await expireOffers(today, now)
    expect((await row(ended.id)).status).toBe("expired")
    expect((await row(lastDay.id)).status).toBe("published")
  })

  it("un début hier avec une fin future : l'annonce reste publiée", async () => {
    const offer = await insertOffer({
      startDate: "2026-10-21",
      endDate: "2027-03-31",
      durationValue: null,
      durationUnit: null,
    })
    await expireOffers(today, now)
    expect(await row(offer.id)).toMatchObject({
      status: "published",
      expiredAt: null,
    })
  })

  it("ne touche qu'aux annonces publiées, et une seconde exécution n'a aucun effet", async () => {
    const offline = await insertOffer({
      status: "unpublished",
      applicationDeadline: "2026-10-01",
    })
    const offer = await insertOffer({ applicationDeadline: "2026-10-20" })
    expect(await expireOffers(today, now)).toBeGreaterThanOrEqual(1)
    expect(await expireOffers(today, now)).toBe(0)
    expect((await row(offline.id)).status).toBe("unpublished")
    expect((await row(offer.id)).expiredAt).toEqual(now)
  })
})

describe("sendValidityReminders", () => {
  it("30 jours après la publication, le déposant reçoit un lien signé ; la date du rappel est enregistrée", async () => {
    const offer = await insertOffer({
      title: "Barman de nuit",
      publishedAt: daysAgo(31),
      validityConfirmedAt: daysAgo(31),
    })
    const recent = await insertOffer({ publishedAt: daysAgo(29) })

    await sendValidityReminders(now)

    const email = sent.find((item) =>
      item.subject.includes("« Barman de nuit »"),
    )
    expect(email).toMatchObject({
      to: `${DEPOSITOR}@e2e.test`,
      subject: "Votre annonce « Barman de nuit » est-elle toujours valable ?",
    })
    const token = /\/annonce\/confirmer\/([\w.-]+)/.exec(email!.text)?.[1]
    expect(verifyOfferToken(token!, env.VALIDITY_TOKEN_SECRET, now)).toEqual({
      ok: true,
      offerId: offer.id,
    })
    expect(await row(offer.id)).toMatchObject({
      status: "published",
      validityReminderSentAt: now,
    })
    expect((await row(recent.id)).validityReminderSentAt).toBeNull()
  })

  it("sans réponse, l'annonce reste en ligne et le rappel ne repart pas avant 30 jours", async () => {
    const offer = await insertOffer({
      title: "Plongeur sans réponse",
      publishedAt: daysAgo(40),
    })
    await sendValidityReminders(now)
    const tomorrow = new Date(now.getTime() + DAY_MS)
    sent.length = 0
    await sendValidityReminders(tomorrow)
    expect(sent.filter((item) => item.subject.includes(offer.title))).toEqual(
      [],
    )
    expect((await row(offer.id)).status).toBe("published")

    const later = new Date(now.getTime() + 30 * DAY_MS)
    await sendValidityReminders(later)
    expect(
      sent.filter((item) => item.subject.includes(offer.title)),
    ).toHaveLength(1)
  })

  it("ni annonce collectée, ni annonce hors ligne", async () => {
    await insertOffer({
      title: "Collectée ancienne",
      origin: "collected",
      createdByUserId: null,
      sourceUrl: "https://www.hotel-jobs.example/emplois/1",
      sourceCheckedAt: daysAgo(40),
      publishedAt: daysAgo(40),
    })
    await insertOffer({
      title: "Hors ligne ancienne",
      status: "unpublished",
      publishedAt: daysAgo(40),
    })
    await sendValidityReminders(now)
    expect(
      sent.filter((item) => /Collectée|Hors ligne/.test(item.subject)),
    ).toEqual([])
  })
})

describe("tâche quotidienne activable depuis l'admin", () => {
  it("est active tant que personne ne l'a désactivée", async () => {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.name, "daily"))
    expect(await getScheduledJob("daily")).toMatchObject({
      enabled: true,
      lastRunAt: null,
      enabledChangedAt: null,
    })
  })

  it("garde l'auteur et la date du changement, puis le dernier passage", async () => {
    await setScheduledJobEnabled("daily", false, DEPOSITOR, now)
    expect(await getScheduledJob("daily")).toMatchObject({
      enabled: false,
      enabledChangedAt: now,
      updatedByName: "Dominique Déposant",
    })

    const later = new Date(now.getTime() + DAY_MS)
    await setScheduledJobEnabled("daily", true, DEPOSITOR, later)
    const summary = {
      date: "2026-10-23",
      expired: 2,
      reminders: { sent: 1, failed: 0 },
    }
    await recordDailyJobRun(summary, later)
    expect(await getScheduledJob("daily")).toMatchObject({
      enabled: true,
      // Un passage ne change pas la date du dernier changement d'état.
      enabledChangedAt: later,
      lastRunAt: later,
      lastSummary: summary,
    })
  })
})
