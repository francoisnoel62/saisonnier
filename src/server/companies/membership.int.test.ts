import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  companyOnboardingSchema,
  type CompanyOnboarding,
} from "@/domain/membership"
import { db } from "@/lib/db"
import { companies, companyMembers, offers, user } from "@/lib/db/schema"

import {
  createMembership,
  decideMembership,
  getMembership,
  MembershipExistsError,
  updateCompanyDetails,
} from "./membership"

// SIREN propres à ce fichier (clé de Luhn valide), absents du jeu de démonstration.
const SIREN_A = "100000009"
const SIREN_B = "100000017"
const ids = {
  admin: "membership-int-admin",
  first: "membership-int-first",
  second: "membership-int-second",
  rejected: "membership-int-rejected",
}

const onboarding = (siren: string, input: Partial<CompanyOnboarding> = {}) => ({
  ...companyOnboardingSchema.parse({
    legalName: `Entreprise ${siren}`,
    siren,
    siret: "",
    nafCode: "55.10Z",
    nafLabel: "Hôtels et hébergement similaire",
    communeName: "Annecy",
    displayName: "",
    website: "www.entreprise-int.example",
    jobTitle: "Directrice",
    relationship: "executive",
    relationshipDetails: "",
    phone: "04 65 71 00 00",
    certified: true,
  }),
  ...input,
})

async function pendingOffer(userId: string, companyId: string) {
  const [offer] = await db
    .insert(offers)
    .values({
      origin: "deposited",
      companyId,
      createdByUserId: userId,
      title: "Réceptionniste",
      season: "summer",
      communeName: "Annecy",
      departmentCode: "74",
      durationValue: 3,
      durationUnit: "months",
      applyEmail: "rh@entreprise-int.example",
    })
    .returning()
  return offer
}

async function cleanUp() {
  await db.delete(user).where(inArray(user.id, Object.values(ids)))
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(inArray(companies.siren, [SIREN_A, SIREN_B]))
  const companyIds = rows.map((row) => row.id)
  if (companyIds.length > 0) {
    await db.delete(offers).where(inArray(offers.companyId, companyIds))
    await db
      .delete(companyMembers)
      .where(inArray(companyMembers.companyId, companyIds))
    await db.delete(companies).where(inArray(companies.id, companyIds))
  }
}

beforeAll(async () => {
  await cleanUp()
  await db.insert(user).values(
    Object.entries(ids).map(([label, id]) => ({
      id,
      name: `Utilisateur ${label}`,
      email: `${id}@e2e.test`,
      emailVerified: true,
      role: label === "admin" ? "admin" : "employer",
    })),
  )
})

afterAll(async () => {
  await cleanUp()
  await db.$client.end()
})

describe("createMembership", () => {
  it("crée l'entreprise et un rattachement en attente", async () => {
    const { company, member, existingCompany } = await createMembership(
      ids.first,
      onboarding(SIREN_A),
    )
    expect(existingCompany).toBe(false)
    expect(company).toMatchObject({
      siren: SIREN_A,
      nafCode: "55.10Z",
      communeName: "Annecy",
      website: "https://www.entreprise-int.example",
    })
    expect(member).toMatchObject({ status: "pending", reviewedAt: null })
  })

  it("rattache un second compte à l'entreprise déjà connue, sans doublon ni retouche", async () => {
    const { company, existingCompany } = await createMembership(
      ids.second,
      onboarding(SIREN_A, { legalName: "Autre nom", website: null }),
    )
    expect(existingCompany).toBe(true)
    expect(company.legalName).toBe(`Entreprise ${SIREN_A}`)
    expect(
      await db.select().from(companies).where(eq(companies.siren, SIREN_A)),
    ).toHaveLength(1)
  })

  it("refuse un second rattachement pour le même compte", async () => {
    await expect(
      createMembership(ids.first, onboarding(SIREN_B)),
    ).rejects.toBeInstanceOf(MembershipExistsError)
    // La transaction est annulée : l'entreprise B n'a pas été créée.
    expect(
      await db.select().from(companies).where(eq(companies.siren, SIREN_B)),
    ).toEqual([])
  })
})

describe("decideMembership", () => {
  it("valide : rattachement vérifié et annonces en attente publiées", async () => {
    const membership = (await getMembership(ids.first))!
    const offer = await pendingOffer(ids.first, membership.company.id)
    const now = new Date("2026-10-22T10:00:00Z")

    const result = await decideMembership(
      ids.admin,
      { decision: "verify", userId: ids.first },
      now,
    )
    expect(result?.offerIds).toEqual([offer.id])
    expect((await getMembership(ids.first))!.member).toMatchObject({
      status: "verified",
      reviewedAt: now,
      reviewedBy: ids.admin,
    })
    const [published] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offer.id))
    expect(published).toMatchObject({
      status: "published",
      publishedAt: now,
      validityConfirmedAt: now,
    })
  })

  it("ne décide pas deux fois", async () => {
    expect(
      await decideMembership(ids.admin, {
        decision: "reject",
        userId: ids.first,
        reviewNote: "Trop tard",
      }),
    ).toBeNull()
    expect((await getMembership(ids.first))!.member.status).toBe("verified")
  })

  it("refuse : rattachement refusé et motivé, annonces refusées", async () => {
    const { company } = await createMembership(
      ids.rejected,
      onboarding(SIREN_B),
    )
    const offer = await pendingOffer(ids.rejected, company.id)

    await decideMembership(ids.admin, {
      decision: "reject",
      userId: ids.rejected,
      reviewNote: "Aucun lien avec l'entreprise",
    })
    expect((await getMembership(ids.rejected))!.member).toMatchObject({
      status: "rejected",
      reviewNote: "Aucun lien avec l'entreprise",
    })
    const [rejected] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offer.id))
    expect(rejected).toMatchObject({ status: "rejected", publishedAt: null })
  })
})

describe("updateCompanyDetails", () => {
  const details = {
    displayName: "Hôtel modifié",
    website: "https://modifie.example",
    phone: "04 65 71 99 99",
  }

  it("un déposant en attente ne touche pas à une entreprise déjà vérifiée par un autre", async () => {
    expect(await updateCompanyDetails(ids.second, details)).toEqual({
      updated: true,
      companyUpdated: false,
    })
    const { company, member } = (await getMembership(ids.second))!
    expect(company.displayName).toBeNull()
    expect(member.phone).toBe(details.phone)
  })

  it("un déposant vérifié modifie l'enseigne et le site", async () => {
    await updateCompanyDetails(ids.first, details)
    expect((await getMembership(ids.first))!.company).toMatchObject({
      displayName: details.displayName,
      website: details.website,
    })
  })

  it("un rattachement refusé ne se modifie plus", async () => {
    expect(await updateCompanyDetails(ids.rejected, details)).toEqual({
      updated: false,
    })
  })
})
