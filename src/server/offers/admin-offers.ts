import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"

import { adminRepublishRefusal, canAdminUnpublish } from "@/domain/admin-offer"
import { todayInParis } from "@/domain/offer-activity"
import type { AdminOfferInput } from "@/domain/offer-input"
import { db } from "@/lib/db"
import { offers } from "@/lib/db/schema"

import type { OfferWriteResult } from "./employer-offers"
import { isUuid } from "./queries"

// Back-office (plan 15) : le fondateur gère toutes les annonces. Les annonces collectées
// s'enregistrent par upsertCollectedOffer (ingest.ts) ; ce module écrit les annonces déposées
// et change les statuts. L'appelant a vérifié le rôle admin.

export const adminOfferMessages = {
  notFound: "Cette annonce n'existe pas.",
  notCollected: "Seule une annonce collectée a une source à vérifier.",
  notOnline: "Cette annonce n'est pas en ligne.",
} as const

// Toutes les annonces, les plus récentes d'abord, avec ce que l'aperçu affiche.
export async function listAdminOffers() {
  return db.query.offers.findMany({
    with: {
      company: true,
      occupation: true,
      department: { with: { region: true } },
    },
    orderBy: [desc(offers.createdAt), asc(offers.id)],
  })
}

export type AdminOffer = Awaited<ReturnType<typeof listAdminOffers>>[number]

// Colonnes d'une annonce déposée, saisies par l'admin : elle n'a pas de source.
function depositedColumns(input: AdminOfferInput) {
  return {
    ...input,
    origin: "deposited" as const,
    sourceUrl: null,
    sourceName: null,
  }
}

// Annonce transmise par un employeur (sans compte, par exemple) et saisie par le fondateur, qui en
// devient le déposant : c'est lui qui recevra le rappel de validité (plan 16).
export async function createDepositedOfferAsAdmin(
  adminId: string,
  input: AdminOfferInput,
  now = new Date(),
): Promise<OfferWriteResult> {
  const [offer] = await db
    .insert(offers)
    .values({
      ...depositedColumns(input),
      status: "published",
      createdByUserId: adminId,
      publishedAt: now,
      validityConfirmedAt: now,
    })
    .returning({ id: offers.id, status: offers.status })
  return { ok: true, ...offer }
}

// Une annonce déposée garde son entreprise, son déposant et son statut. L'admin y applique les
// demandes de l'employeur, et le canal « chargé de recrutement » des prestations (plan 17).
export async function updateDepositedOfferAsAdmin(
  offerId: string,
  input: AdminOfferInput,
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  // L'entreprise ne change pas : la condition sur `companyId` écarte toute autre valeur.
  const [offer] = await db
    .update(offers)
    .set(depositedColumns(input))
    .where(
      and(
        eq(offers.id, offerId),
        eq(offers.origin, "deposited"),
        eq(offers.companyId, input.companyId),
      ),
    )
    .returning({ id: offers.id, status: offers.status })
  return offer
    ? { ok: true, ...offer }
    : { ok: false, message: adminOfferMessages.notFound }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function lockOffer(tx: Transaction, offerId: string) {
  const [offer] = await tx
    .select({
      id: offers.id,
      origin: offers.origin,
      status: offers.status,
      applicationDeadline: offers.applicationDeadline,
      endDate: offers.endDate,
      publishedAt: offers.publishedAt,
    })
    .from(offers)
    .where(eq(offers.id, offerId))
    .for("update")
  return offer ?? null
}

export async function unpublishOfferAsAdmin(
  offerId: string,
  now = new Date(),
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  return db.transaction(async (tx) => {
    const offer = await lockOffer(tx, offerId)
    if (!offer) return { ok: false, message: adminOfferMessages.notFound }
    if (!canAdminUnpublish(offer)) {
      return { ok: false, message: adminOfferMessages.notOnline }
    }
    await tx
      .update(offers)
      .set({ status: "unpublished", unpublishedAt: now })
      .where(eq(offers.id, offer.id))
    return { ok: true, id: offer.id, status: "unpublished" }
  })
}

// Remise en ligne (§6) : la date de publication d'origine est conservée (H18). Pour une annonce
// déposée, elle vaut confirmation de validité, comme depuis l'espace employeur.
export async function republishOfferAsAdmin(
  offerId: string,
  now = new Date(),
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  return db.transaction(async (tx) => {
    const offer = await lockOffer(tx, offerId)
    if (!offer) return { ok: false, message: adminOfferMessages.notFound }
    const refusal = adminRepublishRefusal(offer, todayInParis(now))
    if (refusal) return { ok: false, message: refusal }
    await tx
      .update(offers)
      .set({
        status: "published",
        publishedAt: offer.publishedAt ?? now,
        unpublishedAt: null,
        expiredAt: null,
        ...(offer.origin === "deposited" ? { validityConfirmedAt: now } : {}),
      })
      .where(eq(offers.id, offer.id))
    return { ok: true, id: offer.id, status: "published" }
  })
}

// « Source vérifiée aujourd'hui » : l'admin a constaté que l'annonce est toujours en ligne sur le
// site de l'employeur ; la fiche affiche cette date aux candidats (§6).
export async function markSourceChecked(
  offerId: string,
  now = new Date(),
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  const [offer] = await db
    .update(offers)
    .set({ sourceCheckedAt: now })
    .where(and(eq(offers.id, offerId), eq(offers.origin, "collected")))
    .returning({ id: offers.id, status: offers.status })
  return offer
    ? { ok: true, ...offer }
    : { ok: false, message: adminOfferMessages.notCollected }
}
