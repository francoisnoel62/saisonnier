import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { offers } from "@/lib/db/schema"
import { env } from "@/lib/env"
import { verifyOfferToken } from "@/lib/signed-token"

import { isUuid } from "./queries"

// Réponse au rappel de validité (§6, plan 16), par le lien signé de l'email : le jeton désigne
// l'annonce et suffit à répondre, sans session.

export type TokenOffer =
  | {
      ok: true
      offer: NonNullable<Awaited<ReturnType<typeof findDepositedOffer>>>
    }
  | { ok: false; reason: "invalid" | "expired" }

function findDepositedOffer(offerId: string) {
  return db.query.offers.findFirst({
    where: and(eq(offers.id, offerId), eq(offers.origin, "deposited")),
    columns: {
      id: true,
      title: true,
      status: true,
      communeName: true,
      departmentCode: true,
      publishedAt: true,
      validityConfirmedAt: true,
    },
    with: { company: { columns: { legalName: true, displayName: true } } },
  })
}

// L'annonce désignée par un jeton, ou la raison du refus.
export async function offerFromToken(
  token: string,
  now = new Date(),
): Promise<TokenOffer> {
  const verified = verifyOfferToken(token, env.VALIDITY_TOKEN_SECRET, now)
  if (!verified.ok) return verified
  const offer = isUuid(verified.offerId)
    ? await findDepositedOffer(verified.offerId)
    : undefined
  return offer ? { ok: true, offer } : { ok: false, reason: "invalid" }
}

// « Oui, toujours valable » : l'annonce reste en ligne, le prochain rappel part dans 30 jours.
export async function confirmValidity(offerId: string, now = new Date()) {
  const [offer] = await db
    .update(offers)
    .set({ validityConfirmedAt: now })
    .where(and(eq(offers.id, offerId), eq(offers.status, "published")))
    .returning({ id: offers.id })
  return !!offer
}

// « Non, retirer l'annonce » : elle passe hors ligne, comme depuis l'espace employeur.
export async function withdrawOffer(offerId: string, now = new Date()) {
  const [offer] = await db
    .update(offers)
    .set({ status: "unpublished", unpublishedAt: now })
    .where(and(eq(offers.id, offerId), eq(offers.status, "published")))
    .returning({ id: offers.id })
  return !!offer
}
