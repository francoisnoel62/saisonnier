import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { todayInParis } from "@/domain/offer-activity"
import {
  emptyOfferFormValues,
  offerInputContext,
  offerInputSchema,
  type OfferFormValues,
  type OfferInput,
} from "@/domain/offer-input"
import { db } from "@/lib/db"
import {
  companies,
  companyMembers,
  occupations,
  offers,
  user,
} from "@/lib/db/schema"

import {
  countEmployerOffers,
  createEmployerOffer,
  getEmployerOffer,
  getOfferFormReferentials,
  listEmployerOffers,
  republishEmployerOffer,
  unpublishEmployerOffer,
  updateEmployerOffer,
} from "./employer-offers"
import { activeOfferConditions } from "./queries"

// SIREN propres à ce fichier (clé de Luhn valide), absents du jeu de démonstration.
const SIREN_HOTEL = "200000008"
const SIREN_OTHER = "200000016"
const ids = {
  verified: "employer-offers-int-verified",
  colleague: "employer-offers-int-colleague",
  pending: "employer-offers-int-pending",
  rejected: "employer-offers-int-rejected",
  other: "employer-offers-int-other",
  orphan: "employer-offers-int-orphan",
}
const now = new Date("2026-10-22T10:00:00Z")
const today = todayInParis(now)

let hotelId: string
let otherId: string
let schema: ReturnType<typeof offerInputSchema>

// Annonce minimale, validée par le schéma partagé avec le formulaire.
const input = (values: Partial<OfferFormValues> = {}): OfferInput =>
  schema.parse({
    ...emptyOfferFormValues(),
    title: "Serveur / serveuse",
    seasonalContract: true,
    season: "winter",
    periodKind: "duration",
    durationValue: "4",
    durationUnit: "months",
    communeName: "Gérardmer",
    communeInseeCode: "88196",
    postalCode: "88400",
    departmentCode: "88",
    applyEmail: "rh@hotel-int.example",
    ...values,
  })

async function created(userId: string, values: Partial<OfferFormValues> = {}) {
  const result = await createEmployerOffer(userId, input(values), now)
  if (!result.ok) throw new Error(result.message)
  return result
}

async function row(id: string) {
  const [offer] = await db.select().from(offers).where(eq(offers.id, id))
  return offer
}

async function isActiveInSearch(id: string) {
  const rows = await db
    .select({ id: offers.id })
    .from(offers)
    .where(
      and(eq(offers.id, id), activeOfferConditions(todayInParis(new Date()))),
    )
  return rows.length === 1
}

async function cleanUp() {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(inArray(companies.siren, [SIREN_HOTEL, SIREN_OTHER]))
  const companyIds = rows.map((r) => r.id)
  if (companyIds.length > 0) {
    await db.delete(offers).where(inArray(offers.companyId, companyIds))
    await db
      .delete(companyMembers)
      .where(inArray(companyMembers.companyId, companyIds))
    await db.delete(companies).where(inArray(companies.id, companyIds))
  }
  await db.delete(user).where(inArray(user.id, Object.values(ids)))
}

beforeAll(async () => {
  await cleanUp()
  await db.insert(user).values(
    Object.values(ids).map((id) => ({
      id,
      name: id,
      email: `${id}@e2e.test`,
      emailVerified: true,
      role: "employer",
    })),
  )
  const [hotel, other] = await db
    .insert(companies)
    .values([
      { legalName: "Hôtel du Lac", siren: SIREN_HOTEL },
      { legalName: "Autre entreprise", siren: SIREN_OTHER },
    ])
    .returning()
  hotelId = hotel.id
  otherId = other.id
  const member = (
    userId: string,
    companyId: string,
    status: "pending" | "verified" | "rejected",
  ) => ({
    userId,
    companyId,
    jobTitle: "Gérant",
    relationship: "executive" as const,
    status,
    reviewedAt: status === "pending" ? null : now,
    reviewNote: status === "rejected" ? "Lien non vérifiable." : null,
  })
  await db
    .insert(companyMembers)
    .values([
      member(ids.verified, hotelId, "verified"),
      member(ids.colleague, hotelId, "verified"),
      member(ids.pending, hotelId, "pending"),
      member(ids.rejected, hotelId, "rejected"),
      member(ids.other, otherId, "verified"),
    ])

  schema = offerInputSchema(
    offerInputContext(await getOfferFormReferentials(), today),
  )
})

afterAll(async () => {
  await cleanUp()
  await db.$client.end()
})

describe("getOfferFormReferentials", () => {
  it("fournit les métiers actifs, les départements et les domaines exclus", async () => {
    const referentials = await getOfferFormReferentials()
    expect(referentials.departments).toContainEqual({
      code: "88",
      name: "Vosges",
      regionName: "Grand Est",
    })
    expect(referentials.blockedDomains).toEqual(
      expect.arrayContaining(["indeed.fr", "indeedemail.com"]),
    )
    expect(referentials.occupations.length).toBeGreaterThan(0)
  })

  it("garde le métier d'une annonce modifiée, même désactivé depuis", async () => {
    const [occupation] = await db
      .insert(occupations)
      .values({
        slug: "employer-offers-int-retire",
        label: "Métier retiré",
        family: "Test",
        isActive: false,
      })
      .returning()
    try {
      const ids = async (current?: string) =>
        (await getOfferFormReferentials(current)).occupations.map((o) => o.id)
      expect(await ids()).not.toContain(occupation.id)
      expect(await ids(occupation.id)).toContain(occupation.id)
    } finally {
      await db.delete(occupations).where(eq(occupations.id, occupation.id))
    }
  })

  it("le schéma refuse les destinations exclues lues en base (H9)", () => {
    const errors = (values: Partial<OfferFormValues>) =>
      schema
        .safeParse({ ...emptyOfferFormValues(), ...values })
        .error?.issues.filter((issue) =>
          ["applyUrl", "applyEmail"].includes(String(issue.path[0])),
        )
        .map((issue) => issue.message)
    expect(
      errors({
        applyUrl: "https://www.indeed.fr/emplois/123",
        applyEmail: "offre-1@indeedemail.com",
      }),
    ).toEqual([
      "Les liens vers indeed.fr ne sont pas acceptés : indiquez un contact direct de l'entreprise.",
      "Les adresses @indeedemail.com ne sont pas acceptées : indiquez un contact direct de l'entreprise.",
    ])
  })
})

describe("createEmployerOffer", () => {
  it("un déposant vérifié publie aussitôt une annonce déposée (H2)", async () => {
    const { id, status } = await created(ids.verified)
    expect(status).toBe("published")
    expect(await row(id)).toMatchObject({
      origin: "deposited",
      status: "published",
      companyId: hotelId,
      createdByUserId: ids.verified,
      applicationChannel: "employer",
      recruiterName: null,
      hideCompanyIdentity: false,
      publishedAt: now,
      validityConfirmedAt: now,
      sourceUrl: null,
    })
    expect(await isActiveInSearch(id)).toBe(true)
  })

  it("« Non précisé » est enregistré tel quel, jamais converti en « Non » (§3)", async () => {
    const { id } = await created(ids.verified)
    expect(await row(id)).toMatchObject({
      housing: "unknown",
      meals: "unknown",
      experienceRequired: "unknown",
      languagesRequired: "unknown",
      languages: [],
      drivingLicenseRequired: "unknown",
      couplesWelcome: "unknown",
      petsAllowed: "unknown",
      workTime: "unknown",
      description: null,
      salaryNetMinCents: null,
      salaryGrossMinCents: null,
    })
  })

  it("enregistre une annonce complète dans le respect de toutes les contraintes", async () => {
    const { id } = await created(ids.verified, {
      periodKind: "dates",
      startDate: "2026-12-12",
      endDate: "2027-04-18",
      applicationDeadline: "2026-11-30",
      salaryNetMin: "1 850,50",
      salaryNetMax: "2 000",
      salaryNetUnit: "month",
      salaryGrossMin: "12,5",
      salaryGrossUnit: "hour",
      housing: "yes",
      meals: "no",
      languagesRequired: "yes",
      languages: ["de", "en"],
      workTime: "full_time",
      weeklyHours: "37,5",
      applyPhone: "04 65 71 12 34",
      applyUrl: "www.hotel-int.example/emplois",
    })
    expect(await row(id)).toMatchObject({
      startDate: "2026-12-12",
      endDate: "2027-04-18",
      durationValue: null,
      salaryNetMinCents: 185_050,
      salaryNetMaxCents: 200_000,
      salaryGrossMinCents: 1_250,
      salaryGrossUnit: "hour",
      housing: "yes",
      meals: "no",
      languages: ["en", "de"],
      weeklyHours: 37.5,
      applyUrl: "https://www.hotel-int.example/emplois",
    })
  })

  it("l'annonce d'un déposant en attente attend sa vérification, invisible", async () => {
    const { id, status } = await created(ids.pending)
    expect(status).toBe("pending_review")
    expect(await row(id)).toMatchObject({
      status: "pending_review",
      publishedAt: null,
      validityConfirmedAt: null,
    })
    expect(await isActiveInSearch(id)).toBe(false)
  })

  it("refuse un déposant refusé, ou sans entreprise", async () => {
    expect(await createEmployerOffer(ids.rejected, input(), now)).toEqual({
      ok: false,
      message:
        "Votre rattachement a été refusé : vous ne pouvez pas déposer d'annonce.",
    })
    expect(await createEmployerOffer(ids.orphan, input(), now)).toEqual({
      ok: false,
      message: "Rattachez d'abord votre compte à votre entreprise.",
    })
  })
})

describe("updateEmployerOffer", () => {
  it("un déposant vérifié modifie une annonce de son entreprise, sans en changer le statut", async () => {
    const { id } = await created(ids.verified)
    const result = await updateEmployerOffer(
      ids.colleague,
      id,
      input({ title: "Chef de rang", housing: "yes" }),
    )
    expect(result).toEqual({ ok: true, id, status: "published" })
    expect(await row(id)).toMatchObject({
      title: "Chef de rang",
      housing: "yes",
      status: "published",
      publishedAt: now,
    })
  })

  it("refuse l'annonce d'une autre entreprise, une annonce collectée et un identifiant mal formé", async () => {
    const { id } = await created(ids.verified)
    const notFound = {
      ok: false,
      message:
        "Cette annonce n'existe pas, ou ne fait pas partie des annonces de votre entreprise.",
    }
    expect(await updateEmployerOffer(ids.other, id, input())).toEqual(notFound)
    expect(
      await updateEmployerOffer(ids.verified, "pas-un-uuid", input()),
    ).toEqual(notFound)

    await db
      .update(offers)
      .set({
        origin: "collected",
        createdByUserId: null,
        sourceUrl: `https://www.hotel-int.example/emplois/${id}`,
        sourceCheckedAt: now,
      })
      .where(eq(offers.id, id))
    expect(await updateEmployerOffer(ids.verified, id, input())).toEqual(
      notFound,
    )
  })

  it("avant sa vérification, un déposant ne touche qu'à ses annonces en attente (H2)", async () => {
    const published = await created(ids.verified)
    expect(
      await updateEmployerOffer(ids.pending, published.id, input()),
    ).toMatchObject({ ok: false })
    expect(
      await unpublishEmployerOffer(ids.pending, published.id, now),
    ).toMatchObject({ ok: false })
    expect((await row(published.id)).status).toBe("published")

    const own = await created(ids.pending)
    expect(
      await updateEmployerOffer(
        ids.pending,
        own.id,
        input({ title: "Barman" }),
      ),
    ).toEqual({ ok: true, id: own.id, status: "pending_review" })
  })

  it("une annonce refusée ne se modifie plus", async () => {
    const { id } = await created(ids.verified)
    await db.update(offers).set({ status: "rejected" }).where(eq(offers.id, id))
    expect(await updateEmployerOffer(ids.verified, id, input())).toEqual({
      ok: false,
      message:
        "Cette annonce ne se modifie pas depuis votre espace : contactez-nous pour toute correction.",
    })
  })
})

describe("mise hors ligne et remise en ligne (§6)", () => {
  it("une annonce mise hors ligne disparaît de la recherche, puis revient", async () => {
    const { id } = await created(ids.verified)
    const later = new Date("2026-10-25T08:00:00Z")

    expect(await unpublishEmployerOffer(ids.verified, id, later)).toEqual({
      ok: true,
      id,
      status: "unpublished",
    })
    expect(await row(id)).toMatchObject({
      status: "unpublished",
      unpublishedAt: later,
    })
    expect(await isActiveInSearch(id)).toBe(false)
    expect(await unpublishEmployerOffer(ids.verified, id, later)).toEqual({
      ok: false,
      message: "Cette annonce n'est pas en ligne.",
    })

    expect(await republishEmployerOffer(ids.colleague, id, later)).toEqual({
      ok: true,
      id,
      status: "published",
    })
    // La remise en ligne confirme la validité, sans remonter l'annonce dans la recherche.
    expect(await row(id)).toMatchObject({
      status: "published",
      publishedAt: now,
      validityConfirmedAt: later,
      unpublishedAt: null,
    })
    expect(await isActiveInSearch(id)).toBe(true)
  })

  it("une annonce échue ne se remet en ligne qu'une fois ses dates corrigées", async () => {
    const { id } = await created(ids.verified, {
      applicationDeadline: "2026-11-30",
    })
    await db
      .update(offers)
      .set({
        status: "expired",
        applicationDeadline: "2026-10-21",
        expiredAt: now,
      })
      .where(eq(offers.id, id))
    expect(await republishEmployerOffer(ids.verified, id, now)).toEqual({
      ok: false,
      message:
        "La date limite de candidature est passée : modifiez-la avant de remettre l'annonce en ligne.",
    })

    await updateEmployerOffer(
      ids.verified,
      id,
      input({ applicationDeadline: "2026-11-30" }),
    )
    expect((await row(id)).status).toBe("expired")
    expect(await republishEmployerOffer(ids.verified, id, now)).toMatchObject({
      ok: true,
    })
    expect(await row(id)).toMatchObject({
      status: "published",
      expiredAt: null,
    })
  })
})

describe("listEmployerOffers et countEmployerOffers", () => {
  it("un déposant vérifié voit les annonces déposées de son entreprise, et elles seules", async () => {
    const mine = await created(ids.verified)
    const colleague = await created(ids.colleague)
    const pendingOwn = await created(ids.pending)
    const elsewhere = await created(ids.other)

    const visible = (
      await listEmployerOffers({
        userId: ids.verified,
        companyId: hotelId,
        status: "verified",
      })
    ).map((offer) => offer.id)
    expect(visible).toEqual(
      expect.arrayContaining([mine.id, colleague.id, pendingOwn.id]),
    )
    expect(visible).not.toContain(elsewhere.id)

    const forPending = (
      await listEmployerOffers({
        userId: ids.pending,
        companyId: hotelId,
        status: "pending",
      })
    ).map((offer) => offer.id)
    expect(forPending).toContain(pendingOwn.id)
    expect(forPending).not.toContain(mine.id)

    expect(
      await getEmployerOffer(
        { userId: ids.other, companyId: otherId, status: "verified" },
        mine.id,
      ),
    ).toBeNull()
  })

  it("compte les annonces par état, échéances comprises", async () => {
    const manager = {
      userId: ids.other,
      companyId: otherId,
      status: "verified" as const,
    }
    await db.delete(offers).where(eq(offers.companyId, otherId))
    await created(ids.other)
    const offline = await created(ids.other)
    await unpublishEmployerOffer(ids.other, offline.id, now)
    const lapsed = await created(ids.other)
    await db
      .update(offers)
      .set({ applicationDeadline: "2026-10-01" })
      .where(eq(offers.id, lapsed.id))

    expect(await countEmployerOffers(manager, today)).toEqual({
      online: 1,
      pending_review: 0,
      offline: 1,
      expired: 1,
      rejected: 0,
    })
  })
})
