import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"

import {
  findBlockedTargets,
  type BlockedTarget,
} from "@/domain/blocked-domains"
import type { ApplicationChannel } from "@/domain/offer"
import type { AdminOfferInput, OfferInput } from "@/domain/offer-input"
import {
  checkPublicationMinimum,
  type MissingItem,
} from "@/domain/offer-minimum"
import { canonicalUrl } from "@/domain/scan/identity"
import { db } from "@/lib/db"
import { companies, departments, offers } from "@/lib/db/schema"

import { getBlockedDomains } from "./application"
import { isUuid } from "./queries"
import { replaceOfferLocations } from "./locations"

export type CollectedOfferInput = OfferInput &
  Partial<
    Pick<
      AdminOfferInput,
      "fieldsToConfirm" | "additionalInfo" | "extraLocations"
    >
  > & {
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
    if (offerId !== undefined && !isUuid(offerId))
      return { ok: false, reason: "not_found" }
    const [current] =
      offerId === undefined
        ? []
        : await tx
            .select({ id: offers.id, sourceUrl: offers.sourceUrl })
            .from(offers)
            .where(and(eq(offers.id, offerId), eq(offers.origin, "collected")))
            .for("update")
    if (offerId !== undefined && !current)
      return { ok: false, reason: "not_found" }
    // Plusieurs recrutements peuvent déjà partager une page. Leur correction
    // reste possible ; seule une création ou un changement de source est contrôlé.
    if (!current?.sourceUrl || canonicalUrl(current.sourceUrl) !== sourceUrl) {
      const sources = await tx
        .select({ id: offers.id, sourceUrl: offers.sourceUrl })
        .from(offers)
        .where(
          and(
            eq(offers.origin, "collected"),
            offerId ? ne(offers.id, offerId) : undefined,
          ),
        )
      const taken = sources.find(
        (row) => row.sourceUrl && canonicalUrl(row.sourceUrl) === sourceUrl,
      )
      if (taken) return { ok: false, reason: "source_taken", offerId: taken.id }
    }

    const { extraLocations = [], ...columns } = input
    const values = { ...columns, sourceUrl, sourceCheckedAt: now }
    if (offerId !== undefined) {
      // Le cycle de vie et la vérification humaine ne sont jamais réécrits ici.
      await tx.update(offers).set(values).where(eq(offers.id, offerId))
      await replaceOfferLocations(tx, offerId, extraLocations)
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
    await replaceOfferLocations(tx, saved.id, extraLocations)
    return { ok: true, offerId: saved.id, created: true }
  })
}
