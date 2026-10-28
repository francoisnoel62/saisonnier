import "server-only"

import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm"

import { isActive, todayInParis } from "@/domain/offer-activity"
import { db } from "@/lib/db"
import {
  companies,
  departments,
  offers,
  offerTracking,
  user,
} from "@/lib/db/schema"
import { getBlockedDomains } from "@/server/offers/application"
import { activeOfferConditions } from "@/server/offers/queries"
import {
  offerListColumns,
  toOfferListItem,
} from "@/server/search/search-offers"

// Offres sauvegardées et « J'ai postulé » (§5). Chaque écriture est idempotente : sauvegarder ou
// déclarer deux fois garde la première date ; retirer ce qui n'existe pas ne fait rien.

type Mark = "saved" | "applied"

const markColumn = (mark: Mark) =>
  mark === "saved" ? offerTracking.savedAt : offerTracking.appliedAt
const otherColumn = (mark: Mark) =>
  mark === "saved" ? offerTracking.appliedAt : offerTracking.savedAt

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// On ne suit qu'une offre visible des candidats aujourd'hui.
async function isTrackable(offerId: string) {
  if (!UUID.test(offerId)) return false
  const count = await db.$count(
    offers,
    and(
      eq(offers.id, offerId),
      activeOfferConditions(todayInParis(new Date())),
    ),
  )
  return count === 1
}

export class OfferNotTrackableError extends Error {
  constructor() {
    super("Cette offre n'est plus active.")
  }
}

export async function setMark(
  userId: string,
  offerId: string,
  mark: Mark,
  value: boolean,
) {
  if (value) {
    if (!(await isTrackable(offerId))) throw new OfferNotTrackableError()
    const now = new Date()
    // La première date est gardée : sauvegarder ou déclarer deux fois ne la change pas.
    await db
      .insert(offerTracking)
      .values(
        mark === "saved"
          ? { userId, offerId, savedAt: now }
          : { userId, offerId, appliedAt: now },
      )
      .onConflictDoUpdate({
        target: [offerTracking.userId, offerTracking.offerId],
        set: mark === "saved" ? { savedAt: now } : { appliedAt: now },
        // Déjà marquée : rien ne change, pas même updatedAt.
        setWhere: isNull(markColumn(mark)),
      })
    return
  }

  if (!UUID.test(offerId)) return
  const row = and(
    eq(offerTracking.userId, userId),
    eq(offerTracking.offerId, offerId),
  )
  // Sans l'autre marque, la ligne n'a plus de raison d'être (contrainte offer_tracking_not_empty).
  await db.transaction(async (tx) => {
    await tx.delete(offerTracking).where(and(row, isNull(otherColumn(mark))))
    await tx
      .update(offerTracking)
      .set(mark === "saved" ? { savedAt: null } : { appliedAt: null })
      .where(and(row, isNotNull(otherColumn(mark))))
  })
}

// Suivi de ces offres par le candidat : pour les boutons des cartes et de la fiche.
export async function getTracking(userId: string, offerIds: string[]) {
  const ids = offerIds.filter((id) => UUID.test(id))
  if (ids.length === 0) return new Map<string, Tracking>()
  const rows = await db
    .select({
      offerId: offerTracking.offerId,
      savedAt: offerTracking.savedAt,
      appliedAt: offerTracking.appliedAt,
    })
    .from(offerTracking)
    .where(
      and(
        eq(offerTracking.userId, userId),
        inArray(offerTracking.offerId, ids),
      ),
    )
  return new Map(rows.map(({ offerId, ...tracking }) => [offerId, tracking]))
}

export type Tracking = { savedAt: Date | null; appliedAt: Date | null }

// « Mes offres » : toutes les offres suivies, actives ou non, les plus récemment suivies d'abord.
export async function getTrackedOffers(userId: string) {
  const today = todayInParis(new Date())
  const rows = await db
    .select({
      ...offerListColumns,
      status: offers.status,
      applicationDeadline: offers.applicationDeadline,
      savedAt: offerTracking.savedAt,
      appliedAt: offerTracking.appliedAt,
    })
    .from(offerTracking)
    .innerJoin(offers, eq(offers.id, offerTracking.offerId))
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .innerJoin(departments, eq(departments.code, offers.departmentCode))
    .leftJoin(user, eq(user.id, offers.createdByUserId))
    .where(eq(offerTracking.userId, userId))
    .orderBy(desc(offerTracking.updatedAt), desc(offerTracking.createdAt))

  const blockedDomains = await getBlockedDomains()
  return rows.map((row) => ({
    offer: toOfferListItem(row, blockedDomains),
    active: isActive(row, today),
    savedAt: row.savedAt,
    appliedAt: row.appliedAt,
  }))
}
