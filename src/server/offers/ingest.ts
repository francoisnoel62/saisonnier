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
import { db } from "@/lib/db"
import { companies, departments, offers } from "@/lib/db/schema"

import { getBlockedDomains } from "./application"
import { isUuid } from "./queries"

// Point d'entrée unique des annonces collectées (§6, H10). En V1, l'admin les saisit dans le
// back-office ; le futur scan nocturne appellera la même fonction. Aucun scraping ici (§8).

// Annonce lue à sa source : ses colonnes, son entreprise, sa source et son canal de candidature.
export type CollectedOfferInput = OfferInput & {
  companyId: string
  sourceUrl: string
  sourceName: string | null
  applicationChannel: ApplicationChannel
  recruiterName: string | null
  hideCompanyIdentity: boolean
}

// Qui enregistre l'annonce : seul le fondateur, ou le scan, modifie une annonce collectée (§9).
export type IngestActor = { kind: "admin"; userId: string } | { kind: "scan" }

export type IngestResult =
  | { ok: true; offerId: string; created: boolean }
  // Refus : éléments du minimum manquants et destinations exclues, à conserver par le futur scan
  // avec les données brutes dans sa file de revue (H16).
  | {
      ok: false
      reason: "rejected"
      missing: MissingItem[]
      blocked: BlockedTarget[]
    }
  // Modification d'une annonce : elle n'existe pas ou n'est pas collectée, ou sa nouvelle source
  // est déjà celle d'une autre annonce collectée.
  | { ok: false; reason: "not_found" | "source_taken" }

// Code d'erreur Postgres d'une violation d'unicité (offers_collected_source_url_unique).
const UNIQUE_VIOLATION = "23505"

function isUniqueViolation(error: unknown) {
  const cause = error instanceof Error ? (error.cause ?? error) : error
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === UNIQUE_VIOLATION
  )
}

// Crée l'annonce collectée, ou met à jour celle qui a la même source (déduplication par
// `sourceUrl`). Le minimum de publication et les domaines exclus sont vérifiés, sur la source comme
// sur les destinations de candidature. L'annonce enregistrée est publiée, et sa source datée
// d'aujourd'hui ; une annonce déjà publiée garde sa date de publication (H18).
//
// `offerId` : modification d'une annonce précise depuis le back-office, dont la source peut changer.
export async function upsertCollectedOffer(
  input: CollectedOfferInput,
  actor: IngestActor,
  { offerId, now = new Date() }: { offerId?: string; now?: Date } = {},
): Promise<IngestResult> {
  const [blockedDomains, company, department] = await Promise.all([
    getBlockedDomains(),
    isUuid(input.companyId)
      ? db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.id, input.companyId))
          .then(([row]) => row)
      : undefined,
    db
      .select({ code: departments.code })
      .from(departments)
      .where(eq(departments.code, input.departmentCode))
      .then(([row]) => row),
  ])

  // Une entreprise ou un département inconnus ne sont pas identifiables (§3).
  const minimum = checkPublicationMinimum(
    {
      ...input,
      companyId: company?.id ?? null,
      departmentCode: department?.code ?? null,
      // Une annonce collectée a toujours sa saison : c'est un contrat saisonnier.
      seasonalContractConfirmed: true,
    },
    { origin: "collected", blockedDomains },
  )
  if (!minimum.ok) {
    return {
      ok: false,
      reason: "rejected",
      missing: minimum.missing,
      blocked: findBlockedTargets(input, blockedDomains),
    }
  }

  const values = {
    ...input,
    origin: "collected" as const,
    status: "published" as const,
    // Personne ne l'a déposée : le service l'a reprise du site de l'employeur.
    createdByUserId: null,
    sourceCheckedAt: now,
    unpublishedAt: null,
    expiredAt: null,
  }

  try {
    const result = await db.transaction(async (tx) => {
      if (offerId !== undefined) {
        if (!isUuid(offerId)) return { ok: false, reason: "not_found" } as const
        const [current] = await tx
          .select({ id: offers.id, publishedAt: offers.publishedAt })
          .from(offers)
          .where(and(eq(offers.id, offerId), eq(offers.origin, "collected")))
          .for("update")
        if (!current) return { ok: false, reason: "not_found" } as const

        const [taken] = await tx
          .select({ id: offers.id })
          .from(offers)
          .where(
            and(
              eq(offers.origin, "collected"),
              eq(offers.sourceUrl, input.sourceUrl),
              ne(offers.id, offerId),
            ),
          )
        if (taken) return { ok: false, reason: "source_taken" } as const

        await tx
          .update(offers)
          .set({ ...values, publishedAt: current.publishedAt ?? now })
          .where(eq(offers.id, offerId))
        return { ok: true, offerId, created: false } as const
      }

      // Une même source, une seule annonce : l'index unique tranche entre deux enregistrements
      // simultanés. `xmax = 0` distingue une insertion d'une mise à jour.
      const [saved] = await tx
        .insert(offers)
        .values({ ...values, publishedAt: now })
        .onConflictDoUpdate({
          target: offers.sourceUrl,
          targetWhere: sql`${offers.origin} = 'collected'`,
          set: {
            ...values,
            publishedAt: sql`coalesce(${offers.publishedAt}, excluded.published_at)`,
          },
        })
        .returning({ id: offers.id, created: sql<boolean>`(xmax = 0)` })
      return { ok: true, offerId: saved.id, created: saved.created } as const
    })

    if (result.ok) {
      const who = actor.kind === "admin" ? `l'admin ${actor.userId}` : "le scan"
      console.info(
        `[collecte] Annonce ${result.offerId} ${result.created ? "créée" : "mise à jour"} par ${who} (source ${input.sourceUrl}).`,
      )
    }
    return result
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "source_taken" }
    throw error
  }
}
