import "server-only"

import { and, asc, desc, eq, or } from "drizzle-orm"

import {
  canEditOffer,
  canUnpublishOffer,
  canViewOffer,
  employerOfferState,
  employerOfferStates,
  republishRefusal,
  type EmployerOfferState,
  type OfferManager,
} from "@/domain/employer-offer"
import { canPublishDirectly } from "@/domain/membership"
import type { OfferStatus } from "@/domain/offer"
import { todayInParis } from "@/domain/offer-activity"
import type { OfferFormReferentials, OfferInput } from "@/domain/offer-input"
import { db } from "@/lib/db"
import {
  companyMembers,
  departments,
  occupations,
  offers,
  regions,
} from "@/lib/db/schema"
import type { Membership } from "@/server/companies/membership"

import { getBlockedDomains } from "./application"
import { getOfferWithRelations, isUuid } from "./queries"

// Annonces déposées par les employeurs (plan 14). L'appelant passe l'identifiant de la session,
// jamais une valeur venue de la requête ; chaque écriture revérifie le rattachement et l'annonce.

export function managerOf({ member }: Membership): OfferManager {
  return {
    userId: member.userId,
    companyId: member.companyId,
    status: member.status,
  }
}

// Choix du formulaire. Le métier de l'annonce modifiée reste proposé s'il a été désactivé depuis.
export async function getOfferFormReferentials(
  currentOccupationId: string | null = null,
): Promise<OfferFormReferentials> {
  const [occupationRows, departmentRows, blockedDomains] = await Promise.all([
    db
      .select({
        id: occupations.id,
        label: occupations.label,
        family: occupations.family,
      })
      .from(occupations)
      .where(
        currentOccupationId
          ? or(
              eq(occupations.isActive, true),
              eq(occupations.id, currentOccupationId),
            )
          : eq(occupations.isActive, true),
      )
      .orderBy(asc(occupations.sortOrder), asc(occupations.label)),
    db
      .select({
        code: departments.code,
        name: departments.name,
        regionName: regions.name,
      })
      .from(departments)
      .innerJoin(regions, eq(regions.code, departments.regionCode))
      .orderBy(asc(departments.code)),
    getBlockedDomains(),
  ])
  return {
    occupations: occupationRows,
    departments: departmentRows,
    blockedDomains,
  }
}

// Annonces visibles dans l'espace employeur : la règle canViewOffer, en SQL.
function visibleTo(manager: OfferManager) {
  return and(
    eq(offers.origin, "deposited"),
    eq(offers.companyId, manager.companyId),
    manager.status === "verified"
      ? undefined
      : eq(offers.createdByUserId, manager.userId),
  )
}

// Les plus récentes d'abord, avec ce que l'aperçu affiche.
export async function listEmployerOffers(manager: OfferManager) {
  const rows = await db.query.offers.findMany({
    where: visibleTo(manager),
    with: {
      company: true,
      occupation: true,
      department: { with: { region: true } },
    },
    orderBy: [desc(offers.createdAt), asc(offers.id)],
  })
  return rows.filter((offer) => canViewOffer(manager, offer))
}

export type EmployerOffer = Awaited<
  ReturnType<typeof listEmployerOffers>
>[number]

// Nombre d'annonces par état, pour le tableau de bord.
export async function countEmployerOffers(
  manager: OfferManager,
  today: string,
) {
  const rows = await db
    .select({
      origin: offers.origin,
      companyId: offers.companyId,
      createdByUserId: offers.createdByUserId,
      applicationChannel: offers.applicationChannel,
      status: offers.status,
      applicationDeadline: offers.applicationDeadline,
      endDate: offers.endDate,
    })
    .from(offers)
    .where(visibleTo(manager))
  const counts = Object.fromEntries(
    employerOfferStates.map((state) => [state, 0]),
  ) as Record<EmployerOfferState, number>
  for (const offer of rows) {
    if (canViewOffer(manager, offer)) {
      counts[employerOfferState(offer, today)] += 1
    }
  }
  return counts
}

// Une annonce de l'espace employeur, ou null si elle n'en fait pas partie.
export async function getEmployerOffer(manager: OfferManager, offerId: string) {
  const offer = await getOfferWithRelations(offerId)
  return offer && canViewOffer(manager, offer) ? offer : null
}

export type OfferWriteResult =
  { ok: true; id: string; status: OfferStatus } | { ok: false; message: string }

export const offerMessages = {
  noMembership: "Rattachez d'abord votre compte à votre entreprise.",
  rejected:
    "Votre rattachement a été refusé : vous ne pouvez pas déposer d'annonce.",
  notFound:
    "Cette annonce n'existe pas, ou ne fait pas partie des annonces de votre entreprise.",
  notEditable:
    "Cette annonce ne se modifie pas depuis votre espace : contactez-nous pour toute correction.",
  notOnline: "Cette annonce n'est pas en ligne.",
} as const

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Rattachement du déposant, verrouillé jusqu'à la fin de la transaction : la décision de l'admin
// (decideMembership) ne peut pas s'intercaler entre la lecture du statut et l'écriture (H2).
async function lockManager(tx: Transaction, userId: string) {
  const [manager] = await tx
    .select({
      userId: companyMembers.userId,
      companyId: companyMembers.companyId,
      status: companyMembers.status,
    })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))
    .for("share")
  return manager ?? null
}

async function lockOffer(tx: Transaction, offerId: string) {
  const [offer] = await tx
    .select({
      id: offers.id,
      origin: offers.origin,
      companyId: offers.companyId,
      createdByUserId: offers.createdByUserId,
      applicationChannel: offers.applicationChannel,
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

// Valeurs imposées : une annonce déposée par l'employeur, qui reçoit lui-même les candidatures.
// L'anonymat et le chargé de recrutement relèvent des prestations, gérées par l'admin (plan 15).
// Déposant vérifié : l'annonce est publiée aussitôt ; sinon, elle attend la vérification (H2).
export async function createEmployerOffer(
  userId: string,
  input: OfferInput,
  now = new Date(),
): Promise<OfferWriteResult> {
  return db.transaction(async (tx) => {
    const manager = await lockManager(tx, userId)
    if (!manager) return { ok: false, message: offerMessages.noMembership }
    if (manager.status === "rejected") {
      return { ok: false, message: offerMessages.rejected }
    }

    const publish = canPublishDirectly(manager.status)
    const [offer] = await tx
      .insert(offers)
      .values({
        ...input,
        origin: "deposited",
        status: publish ? "published" : "pending_review",
        companyId: manager.companyId,
        createdByUserId: manager.userId,
        applicationChannel: "employer",
        recruiterName: null,
        hideCompanyIdentity: false,
        publishedAt: publish ? now : null,
        validityConfirmedAt: publish ? now : null,
      })
      .returning({ id: offers.id, status: offers.status })
    return { ok: true, ...offer }
  })
}

// Le statut ne change pas : une annonce en ligne le reste, une annonce en attente aussi.
export async function updateEmployerOffer(
  userId: string,
  offerId: string,
  input: OfferInput,
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return db.transaction(async (tx) => {
    const manager = await lockManager(tx, userId)
    const offer = await lockOffer(tx, offerId)
    if (!manager || !offer || !canViewOffer(manager, offer)) {
      return { ok: false, message: offerMessages.notFound }
    }
    if (!canEditOffer(manager, offer)) {
      return { ok: false, message: offerMessages.notEditable }
    }
    await tx.update(offers).set(input).where(eq(offers.id, offer.id))
    return { ok: true, id: offer.id, status: offer.status }
  })
}

export async function unpublishEmployerOffer(
  userId: string,
  offerId: string,
  now = new Date(),
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return db.transaction(async (tx) => {
    const manager = await lockManager(tx, userId)
    const offer = await lockOffer(tx, offerId)
    if (!manager || !offer || !canViewOffer(manager, offer)) {
      return { ok: false, message: offerMessages.notFound }
    }
    if (!canUnpublishOffer(manager, offer)) {
      return { ok: false, message: offerMessages.notOnline }
    }
    await tx
      .update(offers)
      .set({ status: "unpublished", unpublishedAt: now })
      .where(eq(offers.id, offer.id))
    return { ok: true, id: offer.id, status: "unpublished" }
  })
}

// Remise en ligne d'une annonce retirée ou expirée, une fois ses dates corrigées (§6). Elle vaut
// confirmation de validité ; sa date de publication, qui ordonne la recherche, ne change pas.
export async function republishEmployerOffer(
  userId: string,
  offerId: string,
  now = new Date(),
): Promise<OfferWriteResult> {
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return db.transaction(async (tx) => {
    const manager = await lockManager(tx, userId)
    const offer = await lockOffer(tx, offerId)
    if (!manager || !offer || !canViewOffer(manager, offer)) {
      return { ok: false, message: offerMessages.notFound }
    }
    const refusal = republishRefusal(manager, offer, todayInParis(now))
    if (refusal) return { ok: false, message: refusal }
    await tx
      .update(offers)
      .set({
        status: "published",
        publishedAt: offer.publishedAt ?? now,
        validityConfirmedAt: now,
        unpublishedAt: null,
        expiredAt: null,
      })
      .where(eq(offers.id, offer.id))
    return { ok: true, id: offer.id, status: "published" }
  })
}
