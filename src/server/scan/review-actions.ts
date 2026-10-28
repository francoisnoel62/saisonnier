"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { todayInParis } from "@/domain/offer-activity"
import {
  adminOfferInputSchema,
  offerInputContext,
  type AdminOfferFormValues,
} from "@/domain/offer-input"
import { manualRejectionReasons } from "@/domain/scan/vocabulary"
import { requireRole } from "@/lib/dal"
import type { AdminOfferFormResult } from "@/server/offers/admin-actions"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"

import { decideDuplicate } from "./duplicates"
import { decideOccupation, type OccupationDecision } from "./occupations"
import { publishCandidate } from "./publication"
import {
  candidateOccupationId,
  nextReviewPath,
  rejectCandidate,
  reviewConflictMessage,
} from "./review"

function revalidateReview() {
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
}
export async function validateScanCandidate(
  candidateId: string,
  version: number,
  values: unknown,
): Promise<AdminOfferFormResult> {
  const { user } = await requireRole("admin")
  if (
    !z.uuid().safeParse(candidateId).success ||
    !Number.isInteger(version) ||
    version < 1
  )
    return { ok: false, message: reviewConflictMessage }
  const submitted =
    values && typeof values === "object"
      ? (values as Partial<AdminOfferFormValues>)
      : {}
  const referentials = await getOfferFormReferentials(
    await candidateOccupationId(candidateId),
  )
  const parsed = adminOfferInputSchema(
    offerInputContext(referentials, todayInParis(new Date())),
  ).safeParse({ ...submitted, origin: "collected" })
  if (!parsed.success)
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const result = await publishCandidate({
    candidateId,
    kind: "admin",
    userId: user.id,
    version,
    input: parsed.data,
  })
  if (!result.ok) {
    if (result.reason === "already_published")
      return {
        ok: false,
        message:
          "Ce dossier a déjà été publié, depuis un autre onglet ou lors d'un envoi précédent : vos modifications n'ont pas été enregistrées. Ouvrez l'annonce publiée pour la corriger.",
      }
    return {
      ok: false,
      message:
        result.reason === "conflict"
          ? reviewConflictMessage
          : `Publication impossible : ${result.issues.map((issue) => issue.label).join(" ; ")}`,
    }
  }
  revalidateReview()
  return {
    ok: true,
    offerId: result.offerId,
    status: "published",
    next: await nextReviewPath(candidateId),
  }
}
export async function rejectScanCandidate(
  candidateId: string,
  version: number,
  reason: unknown,
  note?: string,
) {
  const { user } = await requireRole("admin")
  const parsed = z
    .object({
      candidateId: z.uuid(),
      version: z.number().int().positive(),
      reason: z.enum(manualRejectionReasons),
      note: z.string().max(2000).optional(),
    })
    .safeParse({ candidateId, version, reason, note })
  if (!parsed.success)
    return {
      ok: false,
      message: "Choisissez un motif de rejet valide.",
    } as const
  const result = await rejectCandidate(
    candidateId,
    version,
    parsed.data.reason,
    parsed.data.note,
    user.id,
  )
  if (!result.ok) return result
  revalidateReview()
  return { ok: true, next: await nextReviewPath(candidateId) } as const
}
export async function decideDuplicateAction(
  reviewId: string,
  decision: "duplicate" | "distinct",
  note?: string,
  candidateId?: string,
) {
  const { user } = await requireRole("admin")
  if (note !== undefined && (typeof note !== "string" || note.length > 2000))
    return {
      ok: false,
      message: "La note ne doit pas dépasser 2 000 caractères.",
    } as const
  const result = await decideDuplicate(
    reviewId,
    decision,
    user.id,
    note,
    candidateId,
  )
  if (!result.ok) return { ok: false, message: reviewConflictMessage } as const
  revalidateReview()
  return { ok: true } as const
}
export async function decideOccupationAction(
  reviewId: string,
  decision: OccupationDecision,
) {
  const { user } = await requireRole("admin")
  const parsed = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("attach"), occupationId: z.uuid() }),
      z.object({
        kind: z.literal("create"),
        input: z.object({ label: z.string(), family: z.string() }),
      }),
      z.object({ kind: z.literal("reject") }),
    ])
    .safeParse(decision)
  if (!parsed.success)
    return { ok: false, message: "Décision invalide." } as const
  const result = await decideOccupation(reviewId, parsed.data, user.id)
  if (result.ok) revalidateReview()
  return result
}
