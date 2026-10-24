import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"

import {
  findBlockedTargets,
  type BlockedTarget,
} from "@/domain/blocked-domains"
import type { ApplicationChannel } from "@/domain/offer"
import type { OfferInput } from "@/domain/offer-input"
import {
  checkPublicationMinimum,
  type MissingItem,
} from "@/domain/offer-minimum"
import { canonicalUrl } from "@/domain/scan/identity"
import { db } from "@/lib/db"
import { companies, departments, offers } from "@/lib/db/schema"

import { getBlockedDomains } from "./application"
import { isUuid } from "./queries"

export type CollectedOfferInput = OfferInput & {
  companyId: string
  sourceUrl: string
  sourceName: string | null
  applicationChannel: ApplicationChannel
  recruiterName: string | null
  hideCompanyIdentity: boolean
}
export type IngestActor = { kind: "admin"; userId: string }
export type IngestResult =
  | { ok: true; offerId: string; created: boolean }
  | {
      ok: false
      reason: "rejected"
      missing: MissingItem[]
      blocked: BlockedTarget[]
    }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "source_taken"; offerId: string }

// Saisie admin uniquement. La publication du scan passe par publishCandidate.
// Le nom historique reste partagé avec les actions existantes ; aucun upsert SQL.
export async function upsertCollectedOffer(
  input: CollectedOfferInput,
  actor: IngestActor,
  { offerId, now = new Date() }: { offerId?: string; now?: Date } = {},
): Promise<IngestResult> {
  return db.transaction(async (tx) => {
    const blockedDomains = await getBlockedDomains(tx)
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(
        eq(
          companies.id,
          isUuid(input.companyId)
            ? input.companyId
            : "00000000-0000-0000-0000-000000000000",
        ),
      )
    const [department] = await tx
      .select({ code: departments.code })
      .from(departments)
      .where(eq(departments.code, input.departmentCode))
    const minimum = checkPublicationMinimum(
      {
        ...input,
        companyId: company?.id,
        departmentCode: department?.code,
        // adminOfferInputSchema exige la case « contrat saisonnier ».
        seasonalContractConfirmed: true,
      },
      { origin: "collected", blockedDomains },
    )
    if (!minimum.ok)
      return {
        ok: false,
        reason: "rejected",
        missing: minimum.missing,
        blocked: findBlockedTargets(input, blockedDomains),
      }

    const sourceUrl = canonicalUrl(input.sourceUrl)
    if (!sourceUrl) return { ok: false, reason: "not_found" }
    // L'index n'est plus unique : sérialiser les saisies admin par URL canonique.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('admin-collected-source'), hashtext(${sourceUrl}))`,
    )
    const sources = await tx
      .select({ id: offers.id, sourceUrl: offers.sourceUrl })
      .from(offers)
      .where(
        and(
          eq(offers.origin, "collected"),
          offerId && isUuid(offerId) ? ne(offers.id, offerId) : undefined,
        ),
      )
    const taken = sources.find(
      (row) => row.sourceUrl && canonicalUrl(row.sourceUrl) === sourceUrl,
    )
    if (taken) return { ok: false, reason: "source_taken", offerId: taken.id }

    const values = { ...input, sourceUrl, sourceCheckedAt: now }
    if (offerId !== undefined) {
      if (!isUuid(offerId)) return { ok: false, reason: "not_found" }
      const [current] = await tx
        .select({ id: offers.id })
        .from(offers)
        .where(and(eq(offers.id, offerId), eq(offers.origin, "collected")))
        .for("update")
      if (!current) return { ok: false, reason: "not_found" }
      // Le cycle de vie et la vérification humaine ne sont jamais réécrits ici.
      await tx.update(offers).set(values).where(eq(offers.id, offerId))
      return { ok: true, offerId, created: false }
    }
    const [saved] = await tx
      .insert(offers)
      .values({
        ...values,
        origin: "collected",
        status: "published",
        createdByUserId: null,
        publishedAt: now,
        humanVerifiedAt: now,
        humanVerifiedByUserId: actor.userId,
      })
      .returning({ id: offers.id })
    return { ok: true, offerId: saved.id, created: true }
  })
}
