import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { OfferManager } from "@/domain/employer-offer"
import {
  serviceRequestSchema,
  type ServiceRequestInput,
} from "@/domain/service-request"
import { db } from "@/lib/db"
import {
  companies,
  companyMembers,
  offers,
  serviceRequests,
  user,
} from "@/lib/db/schema"

import {
  createServiceRequest,
  listEmployerServiceRequests,
  listServiceRequestsForAdmin,
  updateServiceRequest,
} from "./requests"

// SIREN propres à ce fichier (clé de Luhn valide), absents du jeu de démonstration.
const SIREN_HOTEL = "500000005"
const SIREN_OTHER = "500000013"
const ids = {
  verified: "services-int-verified",
  pending: "services-int-pending",
  other: "services-int-other",
}

let hotelId: string
let otherId: string
let hotelOfferId: string
let otherOfferId: string

const manager = (
  userId: string,
  companyId: string,
  status: OfferManager["status"],
): OfferManager => ({ userId, companyId, status })

const input = (values: Record<string, unknown> = {}): ServiceRequestInput =>
  serviceRequestSchema.parse({
    services: ["human_selection"],
    scope: "campaign",
    offerId: "",
    scopeDetails: "Douze postes pour l'été",
    purchaseFormat: "package",
    message: "",
    ...values,
  })

async function insertOffer(companyId: string, createdByUserId: string) {
  const [offer] = await db
    .insert(offers)
    .values({
      origin: "deposited",
      status: "published",
      publishedAt: new Date(),
      companyId,
      createdByUserId,
      title: "Serveur / serveuse",
      season: "summer",
      communeName: "Lacanau",
      departmentCode: "33",
      durationValue: 3,
      durationUnit: "months",
      applyEmail: "rh@hotel-services.example",
    })
    .returning({ id: offers.id })
  return offer.id
}

async function cleanUp() {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(inArray(companies.siren, [SIREN_HOTEL, SIREN_OTHER]))
  const companyIds = rows.map((row) => row.id)
  if (companyIds.length > 0) {
    await db
      .delete(serviceRequests)
      .where(inArray(serviceRequests.companyId, companyIds))
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
      { legalName: "Hôtel des Services", siren: SIREN_HOTEL },
      { legalName: "Autre entreprise", siren: SIREN_OTHER },
    ])
    .returning()
  hotelId = hotel.id
  otherId = other.id
  hotelOfferId = await insertOffer(hotelId, ids.verified)
  otherOfferId = await insertOffer(otherId, ids.other)
})

afterAll(async () => {
  await cleanUp()
  await db.$client.end()
})

describe("demandes de prestations", () => {
  it("enregistre une demande sur une annonce de l'entreprise", async () => {
    const result = await createServiceRequest(
      manager(ids.verified, hotelId, "verified"),
      input({ scope: "offer", offerId: hotelOfferId, scopeDetails: "" }),
    )
    expect(result).toMatchObject({
      ok: true,
      offerTitle: "Serveur / serveuse",
      request: {
        companyId: hotelId,
        requestedByUserId: ids.verified,
        services: ["human_selection"],
        scope: "offer",
        offerId: hotelOfferId,
        status: "new",
      },
    })
  })

  it("refuse l'annonce d'une autre entreprise", async () => {
    const result = await createServiceRequest(
      manager(ids.verified, hotelId, "verified"),
      input({ scope: "offer", offerId: otherOfferId, scopeDetails: "" }),
    )
    expect(result).toEqual({
      ok: false,
      message:
        "Cette annonce ne fait pas partie des annonces de votre entreprise.",
    })
  })

  it("un déposant vérifié suit les demandes de son entreprise, un déposant en attente les siennes (H20)", async () => {
    await createServiceRequest(
      manager(ids.pending, hotelId, "pending"),
      input({ scopeDetails: "Demande du déposant en attente" }),
    )
    const verified = await listEmployerServiceRequests(
      manager(ids.verified, hotelId, "verified"),
    )
    const pending = await listEmployerServiceRequests(
      manager(ids.pending, hotelId, "pending"),
    )
    expect(verified.length).toBeGreaterThan(pending.length)
    expect(pending.map((request) => request.scopeDetails)).toEqual([
      "Demande du déposant en attente",
    ])
    // La note interne n'est jamais lue pour l'employeur.
    expect(verified[0]).not.toHaveProperty("adminNote")
  })

  it("le fondateur change le statut et ajoute une note interne", async () => {
    const created = await createServiceRequest(
      manager(ids.verified, hotelId, "verified"),
      input(),
    )
    if (!created.ok) throw new Error(created.message)

    expect(
      await updateServiceRequest(created.request.id, {
        status: "in_progress",
        adminNote: "Devis envoyé.",
      }),
    ).toBe(true)
    const [row] = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, created.request.id))
    expect(row).toMatchObject({
      status: "in_progress",
      adminNote: "Devis envoyé.",
    })

    const admin = await listServiceRequestsForAdmin()
    expect(admin.find((request) => request.id === row.id)).toMatchObject({
      companyLegalName: "Hôtel des Services",
      requesterEmail: `${ids.verified}@e2e.test`,
      adminNote: "Devis envoyé.",
    })
  })

  it("une demande sans prestation est refusée par la base", async () => {
    await expect(
      db.insert(serviceRequests).values({
        companyId: hotelId,
        services: [],
        scope: "campaign",
        purchaseFormat: "single",
      }),
    ).rejects.toThrow()
  })
})
