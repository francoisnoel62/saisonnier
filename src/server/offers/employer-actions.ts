"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { OfferStatus } from "@/domain/offer"
import { todayInParis } from "@/domain/offer-activity"
import {
  offerInputContext,
  offerInputSchema,
  type OfferFormField,
} from "@/domain/offer-input"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import { requireRole } from "@/lib/dal"
import { getMembership } from "@/server/companies/membership"

import {
  confirmEmployerOfferValidity,
  createEmployerOffer,
  getEmployerOffer,
  getOfferFormReferentials,
  managerOf,
  offerMessages,
  republishEmployerOffer,
  unpublishEmployerOffer,
  updateEmployerOffer,
  type OfferWriteResult,
} from "./employer-offers"
import { isUuid } from "./queries"

export type OfferFormResult =
  | { ok: true; offerId: string; status: OfferStatus }
  | {
      ok: false
      message?: string
      fieldErrors?: Partial<Record<OfferFormField, string[]>>
    }

export type OfferStatusResult =
  { ok: true; status: OfferStatus } | { ok: false; message: string }

// Une annonce apparaît dans l'espace employeur (tableau de bord compris), dans la recherche, sur
// sa fiche et dans « Mes offres » des candidats.
function revalidateOffers() {
  revalidatePath("/employeur", "layout")
  revalidatePath("/offres", "layout")
  revalidatePath("/mes-offres")
}

// Saisie reçue du formulaire, jamais fiable : formats et cohérence (zod), domaines exclus lus en
// base (H9), puis minimum de publication (§3). Renvoie les colonnes à enregistrer, ou les erreurs.
async function validateOffer(
  values: unknown,
  companyId: string,
  currentOccupationId: string | null,
) {
  const referentials = await getOfferFormReferentials(currentOccupationId)
  const schema = offerInputSchema(
    offerInputContext(referentials, todayInParis(new Date())),
  )
  const parsed = schema.safeParse(values)
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    return Object.keys(fieldErrors).length > 0
      ? ({ ok: false, fieldErrors } as const)
      : ({
          ok: false,
          message: "Le formulaire est incomplet : rechargez la page.",
        } as const)
  }

  const minimum = checkPublicationMinimum(
    {
      ...parsed.data,
      companyId,
      seasonalContractConfirmed: true,
      applicationChannel: "employer",
    },
    { origin: "deposited", blockedDomains: referentials.blockedDomains },
  )
  if (!minimum.ok) {
    return {
      ok: false,
      message: `Le minimum de publication n'est pas atteint : ${minimum.missing
        .map((item) => item.label)
        .join(" ; ")}`,
    } as const
  }
  return { ok: true, input: parsed.data } as const
}

function toFormResult(result: OfferWriteResult): OfferFormResult {
  if (!result.ok) return { ok: false, message: result.message }
  revalidateOffers()
  return { ok: true, offerId: result.id, status: result.status }
}

export async function createOffer(values: unknown): Promise<OfferFormResult> {
  const { user } = await requireRole("employer")
  const membership = await getMembership(user.id)
  if (!membership) return { ok: false, message: offerMessages.noMembership }
  if (membership.member.status === "rejected") {
    return { ok: false, message: offerMessages.rejected }
  }

  const validation = await validateOffer(values, membership.company.id, null)
  if (!validation.ok) return validation
  return toFormResult(await createEmployerOffer(user.id, validation.input))
}

export async function updateOffer(
  offerId: string,
  values: unknown,
): Promise<OfferFormResult> {
  const { user } = await requireRole("employer")
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  const membership = await getMembership(user.id)
  if (!membership) return { ok: false, message: offerMessages.noMembership }
  const offer = await getEmployerOffer(managerOf(membership), offerId)
  if (!offer) return { ok: false, message: offerMessages.notFound }

  const validation = await validateOffer(
    values,
    membership.company.id,
    offer.occupationId,
  )
  if (!validation.ok) return validation
  return toFormResult(
    await updateEmployerOffer(user.id, offerId, validation.input),
  )
}

function toStatusResult(result: OfferWriteResult): OfferStatusResult {
  if (!result.ok) return result
  revalidateOffers()
  return { ok: true, status: result.status }
}

export async function unpublishOffer(
  offerId: string,
): Promise<OfferStatusResult> {
  const { user } = await requireRole("employer")
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return toStatusResult(await unpublishEmployerOffer(user.id, offerId))
}

export async function confirmOfferValidity(
  offerId: string,
): Promise<OfferStatusResult> {
  const { user } = await requireRole("employer")
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return toStatusResult(await confirmEmployerOfferValidity(user.id, offerId))
}

export async function republishOffer(
  offerId: string,
): Promise<OfferStatusResult> {
  const { user } = await requireRole("employer")
  if (!isUuid(offerId)) return { ok: false, message: offerMessages.notFound }
  return toStatusResult(await republishEmployerOffer(user.id, offerId))
}
