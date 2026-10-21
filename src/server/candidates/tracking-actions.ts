"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/dal"

import { OfferNotTrackableError, setMark } from "./tracking"

// Sauvegarde et « J'ai postulé » (§5) : rien d'autre. Chaque action est idempotente ; un clic sur
// un email ou un téléphone de candidature n'en appelle aucune.

export type TrackingResult = { ok: true } | { ok: false; message: string }

async function mark(
  offerId: string,
  kind: "saved" | "applied",
  value: boolean,
): Promise<TrackingResult> {
  const { user } = await requireRole("candidate")
  try {
    await setMark(user.id, offerId, kind, value)
  } catch (error) {
    if (error instanceof OfferNotTrackableError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
  revalidatePath("/mes-offres")
  revalidatePath("/offres", "layout")
  return { ok: true }
}

// `saved` : l'état voulu, pour que deux clics rapides ne s'annulent pas.
export async function toggleSaved(offerId: string, saved: boolean) {
  return mark(offerId, "saved", saved)
}

export async function declareApplied(offerId: string) {
  return mark(offerId, "applied", true)
}

export async function undoApplied(offerId: string) {
  return mark(offerId, "applied", false)
}
