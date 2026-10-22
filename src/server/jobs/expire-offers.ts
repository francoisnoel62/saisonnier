import "server-only"

import { and, eq, lt, or } from "drizzle-orm"

import { assertIsoDate } from "@/domain/offer-activity"
import { db } from "@/lib/db"
import { offers } from "@/lib/db/schema"

// Expiration quotidienne (§6, §9) : une annonce publiée dont la date limite de candidature ou la
// date de fin est passée devient « expirée ». La date de début ne compte pas. La recherche les
// écarte déjà (activeOfferConditions) ; ce job garde des statuts exacts dans les tableaux de bord.
// Idempotent : renvoie le nombre d'annonces passées à « expirée ».
export async function expireOffers(today: string, now = new Date()) {
  assertIsoDate(today)
  const expired = await db
    .update(offers)
    .set({ status: "expired", expiredAt: now })
    .where(
      and(
        eq(offers.status, "published"),
        or(lt(offers.applicationDeadline, today), lt(offers.endDate, today)),
      ),
    )
    .returning({ id: offers.id })
  return expired.length
}
