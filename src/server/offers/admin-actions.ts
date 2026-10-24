"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { companyFileSchema, type CompanyFile } from "@/domain/membership"
import type { OfferStatus } from "@/domain/offer"
import { todayInParis } from "@/domain/offer-activity"
import {
  adminOfferInputSchema,
  offerInputContext,
  type AdminOfferFormField,
  type AdminOfferFormValues,
} from "@/domain/offer-input"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import { requireRole } from "@/lib/dal"
import {
  companyExists,
  createCompanyFile,
  type CompanyOption,
} from "@/server/companies/companies"

import {
  adminOfferMessages,
  createDepositedOfferAsAdmin,
  markSourceChecked,
  republishOfferAsAdmin,
  unpublishOfferAsAdmin,
  updateDepositedOfferAsAdmin,
} from "./admin-offers"
import type { OfferStatusResult } from "./employer-actions"
import {
  getOfferFormReferentials,
  type OfferWriteResult,
} from "./employer-offers"
import { upsertCollectedOffer } from "./ingest"
import { getOfferWithRelations, isUuid } from "./queries"

export type AdminOfferFormResult =
  | { ok: true; offerId: string; status: OfferStatus; next?: string }
  | {
      ok: false
      message?: string
      existingOfferId?: string
      fieldErrors?: Partial<Record<AdminOfferFormField, string[]>>
    }

// Une annonce apparaît dans le back-office (tableau de bord compris), dans la recherche, sur sa
// fiche, dans « Mes offres » des candidats et, déposée, dans l'espace de son employeur.
function revalidateOffers() {
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  revalidatePath("/mes-offres")
  revalidatePath("/employeur", "layout")
}

const minimumMessage = (labels: string[]) =>
  `Le minimum de publication n'est pas atteint : ${labels.join(" ; ")}`

// Création (`offerId` null) ou modification d'une annonce par l'admin. Une annonce collectée passe
// par upsertCollectedOffer, réservé à la saisie admin. Une annonce modifiée
// garde son origine ; déposée, elle garde aussi son entreprise.
export async function saveAdminOffer(
  offerId: string | null,
  values: unknown,
): Promise<AdminOfferFormResult> {
  const { user } = await requireRole("admin")

  const current = offerId === null ? null : await getOfferWithRelations(offerId)
  if (offerId !== null && !current) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  const submitted =
    typeof values === "object" && values !== null
      ? (values as Partial<AdminOfferFormValues>)
      : {}
  const locked = current
    ? {
        origin: current.origin,
        ...(current.origin === "deposited"
          ? { companyId: current.companyId }
          : {}),
      }
    : {}

  const referentials = await getOfferFormReferentials(
    current?.occupationId ?? null,
  )
  const parsed = adminOfferInputSchema(
    offerInputContext(referentials, todayInParis(new Date())),
  ).safeParse({ ...submitted, ...locked })
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    return Object.keys(fieldErrors).length > 0
      ? { ok: false, fieldErrors }
      : {
          ok: false,
          message: "Le formulaire est incomplet : rechargez la page.",
        }
  }

  const input = parsed.data
  if (!(await companyExists(input.companyId))) {
    return {
      ok: false,
      fieldErrors: {
        companyId: [
          "Cette entreprise n'existe plus : choisissez-en une autre.",
        ],
      },
    }
  }

  if (input.origin === "collected" && input.sourceUrl) {
    const result = await upsertCollectedOffer(
      { ...input, sourceUrl: input.sourceUrl },
      { kind: "admin", userId: user.id },
      current ? { offerId: current.id } : {},
    )
    if (result.ok) {
      revalidateOffers()
      return {
        ok: true,
        offerId: result.offerId,
        status: current?.status ?? "published",
      }
    }
    switch (result.reason) {
      case "rejected":
        return {
          ok: false,
          message: minimumMessage(result.missing.map((item) => item.label)),
        }
      case "source_taken":
        return {
          ok: false,
          existingOfferId: result.offerId,
          fieldErrors: {
            sourceUrl: [
              "Une annonce collectée a déjà cette source : modifiez-la plutôt.",
            ],
          },
        }
      case "not_found":
        return { ok: false, message: adminOfferMessages.notFound }
    }
  }

  const minimum = checkPublicationMinimum(
    { ...input, seasonalContractConfirmed: true },
    { origin: "deposited", blockedDomains: referentials.blockedDomains },
  )
  if (!minimum.ok) {
    return {
      ok: false,
      message: minimumMessage(minimum.missing.map((item) => item.label)),
    }
  }
  const result: OfferWriteResult = current
    ? await updateDepositedOfferAsAdmin(current.id, input)
    : await createDepositedOfferAsAdmin(user.id, input)
  if (!result.ok) return { ok: false, message: result.message }
  revalidateOffers()
  return { ok: true, offerId: result.id, status: result.status }
}

function toStatusResult(result: OfferWriteResult): OfferStatusResult {
  if (!result.ok) return result
  revalidateOffers()
  return { ok: true, status: result.status }
}

export async function adminUnpublishOffer(
  offerId: string,
): Promise<OfferStatusResult> {
  await requireRole("admin")
  return toStatusResult(await unpublishOfferAsAdmin(String(offerId)))
}

export async function adminRepublishOffer(
  offerId: string,
): Promise<OfferStatusResult> {
  await requireRole("admin")
  return toStatusResult(await republishOfferAsAdmin(String(offerId)))
}

export async function confirmSourceChecked(
  offerId: string,
): Promise<OfferStatusResult> {
  await requireRole("admin")
  if (!isUuid(offerId)) {
    return { ok: false, message: adminOfferMessages.notFound }
  }
  return toStatusResult(await markSourceChecked(offerId))
}

export type CompanyFileResult =
  | { ok: true; company: CompanyOption; existing: boolean }
  | {
      ok: false
      fieldErrors: Partial<Record<keyof CompanyFile, string[]>>
    }

// Fiche d'une entreprise sans compte, choisie aussitôt dans le formulaire d'annonce.
export async function createCompanyFileAction(
  values: unknown,
): Promise<CompanyFileResult> {
  await requireRole("admin")
  const parsed = companyFileSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const { company, existing } = await createCompanyFile(parsed.data)
  revalidatePath("/admin/annonces", "layout")
  return { ok: true, company, existing }
}
