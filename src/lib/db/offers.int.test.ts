import { eq, inArray, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import {
  companies,
  companyMembers,
  contactMessages,
  offers,
  user,
  type NewOffer,
} from "@/lib/db/schema"

const marker = "Test d'intégration des offres"
const emailDomain = "@offers.int.test"

// Nom de la contrainte refusée par Postgres (ou son code d'erreur), null si l'écriture passe.
async function rejection(write: PromiseLike<unknown>) {
  try {
    await write
  } catch (error) {
    // Drizzle enveloppe l'erreur du pilote dans `cause`.
    const pg = ((error as { cause?: unknown }).cause ?? error) as {
      constraint?: string
      code?: string
    }
    return pg.constraint ?? pg.code ?? String(error)
  }
  return null
}

let companyId: string

// Annonce déposée valide, réduite au minimum.
const valid = (): NewOffer => ({
  origin: "deposited",
  companyId,
  title: "Serveur / serveuse",
  season: "summer",
  communeName: "Lacanau",
  departmentCode: "33",
  durationValue: 3,
  durationUnit: "months",
  applyPhone: "05 36 49 40 30",
})
const insertOffer = (changes: Partial<NewOffer> = {}) =>
  db
    .insert(offers)
    .values({ ...valid(), ...changes })
    .returning()

async function insertUser(label: string) {
  const [row] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: label,
      email: `${label}-${crypto.randomUUID()}${emailDomain}`,
      emailVerified: true,
      role: "employer",
    })
    .returning()
  return row
}

beforeAll(async () => {
  const [company] = await db
    .insert(companies)
    .values({ legalName: marker })
    .returning({ id: companies.id })
  companyId = company.id
})

afterAll(async () => {
  const testCompanies = db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${marker}%`))
  await db
    .delete(contactMessages)
    .where(like(contactMessages.email, `%${emailDomain}`))
  await db.delete(offers).where(inArray(offers.companyId, testCompanies))
  await db
    .delete(companyMembers)
    .where(inArray(companyMembers.companyId, testCompanies))
  await db.delete(user).where(like(user.email, `%${emailDomain}`))
  await db.delete(companies).where(like(companies.legalName, `${marker}%`))
  await db.$client.end()
})

describe("offres : valeurs par défaut", () => {
  it("une information non saisie vaut « non précisé », jamais « non »", async () => {
    const [offer] = await insertOffer()

    expect(offer).toMatchObject({
      status: "pending_review",
      housing: "unknown",
      meals: "unknown",
      experienceRequired: "unknown",
      languagesRequired: "unknown",
      languages: [],
      drivingLicenseRequired: "unknown",
      couplesWelcome: "unknown",
      petsAllowed: "unknown",
      workTime: "unknown",
      applicationChannel: "employer",
      hideCompanyIdentity: false,
    })
  })

  it("garde les heures hebdomadaires à la demi-heure près", async () => {
    const [offer] = await insertOffer({ weeklyHours: 37.5 })
    expect(offer.weeklyHours).toBe(37.5)
  })

  it("lit et écrit les dates de contrat au format AAAA-MM-JJ", async () => {
    const [offer] = await insertOffer({
      startDate: "2027-06-15",
      endDate: "2027-09-15",
      applicationDeadline: "2027-05-31",
    })
    expect(offer).toMatchObject({
      startDate: "2027-06-15",
      endDate: "2027-09-15",
      applicationDeadline: "2027-05-31",
    })
  })
})

describe("offres : contraintes CHECK", () => {
  it.each<[string, Partial<NewOffer>, string]>([
    [
      "une offre sans moyen de candidature",
      { applyPhone: null },
      "offers_application_means",
    ],
    [
      "une offre anonyme sans chargé de recrutement",
      { hideCompanyIdentity: true },
      "offers_anonymity_requires_recruiter",
    ],
    [
      "une offre collectée sans source",
      { origin: "collected", applyUrl: "https://www.monhotel.example/emplois" },
      "offers_collected_has_source",
    ],
    [
      "une offre collectée dont la source n'a jamais été consultée",
      {
        origin: "collected",
        sourceUrl: "https://www.monhotel.example/emplois/1",
      },
      "offers_collected_has_source",
    ],
    [
      "le canal chargé de recrutement sans son nom",
      { applicationChannel: "recruiter" },
      "offers_recruiter_named",
    ],
    [
      "ni période ni durée",
      { durationValue: null, durationUnit: null },
      "offers_period_or_duration",
    ],
    [
      "une date de début seule",
      { durationValue: null, durationUnit: null, startDate: "2027-06-01" },
      "offers_period_or_duration",
    ],
    [
      "une fin avant le début",
      {
        durationValue: null,
        durationUnit: null,
        startDate: "2027-07-01",
        endDate: "2027-06-30",
      },
      "offers_dates_ordered",
    ],
    [
      "une durée sans unité",
      {
        durationUnit: null,
        startDate: "2027-06-01",
        endDate: "2027-08-31",
      },
      "offers_duration_complete",
    ],
    ["une durée nulle", { durationValue: 0 }, "offers_duration_complete"],
    [
      "un salaire net sans unité",
      { salaryNetMinCents: 185000 },
      "offers_net_salary",
    ],
    [
      "une unité de salaire sans montant",
      { salaryNetUnit: "month" },
      "offers_net_salary",
    ],
    [
      "un maximum sans minimum",
      { salaryNetMaxCents: 185000, salaryNetUnit: "month" },
      "offers_net_salary",
    ],
    [
      "un maximum net inférieur au minimum",
      {
        salaryNetMinCents: 185000,
        salaryNetMaxCents: 170000,
        salaryNetUnit: "month",
      },
      "offers_net_salary",
    ],
    [
      "un salaire nul",
      { salaryNetMinCents: 0, salaryNetUnit: "month" },
      "offers_net_salary",
    ],
    [
      "un maximum brut inférieur au minimum",
      {
        salaryGrossMinCents: 1400,
        salaryGrossMaxCents: 1250,
        salaryGrossUnit: "hour",
      },
      "offers_gross_salary",
    ],
    [
      "des langues exigées sans liste",
      { languagesRequired: "yes" },
      "offers_languages_listed",
    ],
    [
      "une liste de langues sans exigence",
      { languagesRequired: "unknown", languages: ["en"] },
      "offers_languages_listed",
    ],
    [
      "un code de langue hors ISO 639-1",
      { languagesRequired: "yes", languages: ["EN"] },
      "offers_language_codes",
    ],
    ["un intitulé fait d'espaces", { title: " \t " }, "offers_text_not_blank"],
    ["un email vide", { applyEmail: "" }, "offers_text_not_blank"],
    [
      "zéro heure par semaine",
      { weeklyHours: 0 },
      "offers_weekly_hours_positive",
    ],
    [
      "une commune d'un autre département",
      { communeInseeCode: "74056" },
      "offers_commune_in_department",
    ],
    [
      "une offre publiée sans date de publication",
      { status: "published" },
      "offers_published_dated",
    ],
  ])("refuse %s", async (_case, changes, constraint) => {
    expect(await rejection(insertOffer(changes))).toBe(constraint)
  })

  it("accepte une date de début avec une durée, et un montant unique", async () => {
    expect(
      await rejection(
        insertOffer({
          startDate: "2027-06-01",
          salaryGrossMinCents: 200000,
          salaryGrossMaxCents: 200000,
          salaryGrossUnit: "month",
        }),
      ),
    ).toBeNull()
  })

  it("accepte une offre anonyme confiée au chargé de recrutement", async () => {
    expect(
      await rejection(
        insertOffer({
          applicationChannel: "recruiter",
          recruiterName: "Camille Rivière",
          hideCompanyIdentity: true,
        }),
      ),
    ).toBeNull()
  })

  it("accepte une commune de Corse-du-Sud dans son département", async () => {
    expect(
      await rejection(
        insertOffer({
          communeName: "Porto-Vecchio",
          communeInseeCode: "2A247",
          departmentCode: "2A",
        }),
      ),
    ).toBeNull()
  })

  it("refuse un département inconnu", async () => {
    expect(await rejection(insertOffer({ departmentCode: "99" }))).toBe(
      "offers_department_code_departments_code_fk",
    )
  })
})

describe("offres collectées : une page peut porter plusieurs recrutements", () => {
  const collected = (sourceUrl: string) => ({
    origin: "collected" as const,
    sourceUrl,
    sourceCheckedAt: new Date(),
    applyUrl: sourceUrl,
  })

  it("accepte deux annonces collectées sur la même source", async () => {
    const url = `https://www.monhotel.example/emplois/${crypto.randomUUID()}`
    expect(await rejection(insertOffer(collected(url)))).toBeNull()
    expect(await rejection(insertOffer(collected(url)))).toBeNull()
  })

  it("ne contraint pas les annonces déposées", async () => {
    const url = `https://www.monhotel.example/emplois/${crypto.randomUUID()}`
    expect(await rejection(insertOffer(collected(url)))).toBeNull()
    expect(await rejection(insertOffer({ sourceUrl: url }))).toBeNull()
  })

  it("réserve la vérification humaine aux annonces collectées", async () => {
    expect(await rejection(insertOffer({ humanVerifiedAt: new Date() }))).toBe(
      "offers_human_verification_collected",
    )
  })

  it("exige la date civile lorsqu'un instant de publication source est connu", async () => {
    expect(
      await rejection(insertOffer({ sourcePublishedAt: new Date() })),
    ).toBe("offers_source_publication_date")
  })
})

describe("entreprises", () => {
  const insertCompany = (values: Partial<typeof companies.$inferInsert>) =>
    db.insert(companies).values({ legalName: `${marker} (SIREN)`, ...values })

  it("accepte un SIREN et un SIRET cohérents", async () => {
    expect(
      await rejection(
        insertCompany({ siren: "900000017", siret: "90000001700012" }),
      ),
    ).toBeNull()
  })

  it.each<[string, Partial<typeof companies.$inferInsert>, string]>([
    [
      "un SIREN avec des espaces",
      { siren: "900 000 025" },
      "companies_siren_format",
    ],
    [
      "un SIRET sans SIREN",
      { siret: "90000003300012" },
      "companies_siret_format",
    ],
    [
      "un SIRET d'une autre entreprise",
      { siren: "900000041", siret: "90000003300012" },
      "companies_siret_format",
    ],
    ["une raison sociale vide", { legalName: " " }, "companies_text_not_blank"],
  ])("refuse %s", async (_case, values, constraint) => {
    expect(await rejection(insertCompany(values))).toBe(constraint)
  })

  it("refuse un SIREN déjà connu", async () => {
    expect(await rejection(insertCompany({ siren: "900000058" }))).toBeNull()
    expect(await rejection(insertCompany({ siren: "900000058" }))).toBe(
      "companies_siren_unique",
    )
  })
})

describe("clés étrangères", () => {
  it("un message de contact garde son texte quand son annonce est supprimée", async () => {
    const [offer] = await insertOffer()
    const [message] = await db
      .insert(contactMessages)
      .values({
        topic: "collected_offer",
        offerId: offer.id,
        name: "Test",
        email: `contact${emailDomain}`,
        message: "Merci de corriger cette annonce.",
      })
      .returning()

    await db.delete(offers).where(eq(offers.id, offer.id))

    const [after] = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, message.id))
    expect(after).toMatchObject({
      offerId: null,
      message: "Merci de corriger cette annonce.",
    })
  })

  it("refuse un message rattaché à une annonce inexistante", async () => {
    expect(
      await rejection(
        db.insert(contactMessages).values({
          topic: "collected_offer",
          offerId: crypto.randomUUID(),
          name: "Test",
          email: `inconnu${emailDomain}`,
          message: "Bonjour",
        }),
      ),
    ).toBe("contact_messages_offer_id_offers_id_fk")
  })

  it("supprimer un compte employeur garde ses annonces et son entreprise", async () => {
    const employer = await insertUser("employeur")
    const admin = await insertUser("admin")
    const [offer] = await insertOffer({ createdByUserId: employer.id })
    await db.insert(companyMembers).values({
      userId: employer.id,
      companyId,
      jobTitle: "Gérante",
      relationship: "executive",
      status: "verified",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    })
    const [colleague] = await db
      .insert(companyMembers)
      .values({
        userId: (await insertUser("collegue")).id,
        companyId,
        jobTitle: "Responsable RH",
        relationship: "hr",
        reviewedBy: admin.id,
      })
      .returning()

    await db.delete(user).where(eq(user.id, employer.id))
    await db.delete(user).where(eq(user.id, admin.id))

    const [kept] = await db.select().from(offers).where(eq(offers.id, offer.id))
    expect(kept.createdByUserId).toBeNull()
    expect(
      await db
        .select()
        .from(companyMembers)
        .where(eq(companyMembers.userId, employer.id)),
    ).toEqual([])
    const [reviewed] = await db
      .select()
      .from(companyMembers)
      .where(eq(companyMembers.userId, colleague.userId))
    expect(reviewed.reviewedBy).toBeNull()
  })
})
