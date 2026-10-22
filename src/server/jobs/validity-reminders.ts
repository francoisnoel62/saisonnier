import "server-only"

import { and, eq, isNotNull, lte, sql } from "drizzle-orm"

import {
  isReminderDue,
  REMINDER_INTERVAL_DAYS,
} from "@/domain/validity-reminder"
import { db } from "@/lib/db"
import { offers, user } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email/send"
import { validityReminderEmail } from "@/lib/email/templates"
import { env } from "@/lib/env"
import { signOfferToken } from "@/lib/signed-token"

// Rappel de validité (§6) : 30 jours après la publication, la dernière confirmation ou le dernier
// rappel, le déposant reçoit un lien signé pour confirmer son annonce ou la retirer. Sans réponse,
// l'annonce reste en ligne : aucune dépublication automatique.

const DAY_MS = 24 * 60 * 60 * 1000

// Dernier signe de vie de l'annonce, en SQL : greatest() ignore les dates absentes.
const lastSignal = sql`greatest(${offers.publishedAt}, ${offers.validityConfirmedAt}, ${offers.validityReminderSentAt})`

export async function sendValidityReminders(now = new Date()) {
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * DAY_MS)
  const due = await db
    .select({
      id: offers.id,
      title: offers.title,
      origin: offers.origin,
      status: offers.status,
      publishedAt: offers.publishedAt,
      validityConfirmedAt: offers.validityConfirmedAt,
      validityReminderSentAt: offers.validityReminderSentAt,
      name: user.name,
      email: user.email,
    })
    .from(offers)
    // Le déposant reçoit le rappel ; une annonce sans déposant (compte supprimé) n'en a pas.
    .innerJoin(user, eq(user.id, offers.createdByUserId))
    .where(
      and(
        eq(offers.origin, "deposited"),
        eq(offers.status, "published"),
        isNotNull(offers.publishedAt),
        lte(lastSignal, cutoff),
      ),
    )

  let sent = 0
  let failed = 0
  for (const offer of due) {
    // La règle pure fait foi ; la requête n'est qu'un premier tri.
    if (!isReminderDue(offer, now)) continue

    // Le rappel est réservé avant l'envoi : deux exécutions simultanées n'en envoient qu'un.
    const [claimed] = await db
      .update(offers)
      .set({ validityReminderSentAt: now })
      .where(
        and(
          eq(offers.id, offer.id),
          eq(offers.status, "published"),
          lte(lastSignal, cutoff),
        ),
      )
      .returning({ id: offers.id })
    if (!claimed) continue

    const token = signOfferToken(offer.id, env.VALIDITY_TOKEN_SECRET, now)
    try {
      await sendEmail({
        to: offer.email,
        ...validityReminderEmail({
          name: offer.name,
          title: offer.title,
          url: `${env.BETTER_AUTH_URL}/annonce/confirmer/${token}`,
        }),
      })
      sent += 1
    } catch (error) {
      // Sans email, pas de rappel : il repartira la nuit suivante.
      await db
        .update(offers)
        .set({ validityReminderSentAt: offer.validityReminderSentAt })
        .where(eq(offers.id, offer.id))
      failed += 1
      console.error(
        `Rappel de validité de l'annonce ${offer.id} impossible`,
        error,
      )
    }
  }
  return { sent, failed }
}
