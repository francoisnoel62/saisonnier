"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { blockedDomainSchema } from "@/domain/blocked-domains"
import { occupationSchema, type OccupationInput } from "@/domain/occupation"
import { requireRole } from "@/lib/dal"
import { isUuid } from "@/server/offers/queries"

import {
  addBlockedDomain,
  addOccupation,
  moveOccupation,
  publishedOffersPointingTo,
  removeBlockedDomain,
  setOccupationActive,
  updateOccupation,
  type AffectedOffer,
} from "./admin"

export type ReferentialResult<Field extends string = string> =
  | { ok: true }
  | {
      ok: false
      message?: string
      fieldErrors?: Partial<Record<Field, string[]>>
    }

const notFound = { ok: false, message: "Ce métier n'existe plus." } as const

// Les métiers alimentent les formulaires d'annonce et les filtres de la recherche ; les domaines
// exclus, les fiches et le back-office.
function revalidateReferentials() {
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  revalidatePath("/employeur", "layout")
}

export async function createOccupation(
  values: unknown,
): Promise<ReferentialResult<keyof OccupationInput>> {
  await requireRole("admin")
  const parsed = occupationSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  await addOccupation(parsed.data)
  revalidateReferentials()
  return { ok: true }
}

export async function editOccupation(
  id: string,
  values: unknown,
): Promise<ReferentialResult<keyof OccupationInput>> {
  await requireRole("admin")
  if (!isUuid(id)) return notFound
  const parsed = occupationSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  if (!(await updateOccupation(id, parsed.data))) return notFound
  revalidateReferentials()
  return { ok: true }
}

// Désactivé, un métier disparaît des formulaires et des filtres, mais reste affiché sur les
// annonces qui le citent.
export async function toggleOccupation(
  id: string,
  isActive: boolean,
): Promise<ReferentialResult> {
  await requireRole("admin")
  if (!isUuid(id)) return notFound
  if (!(await setOccupationActive(id, isActive === true))) return notFound
  revalidateReferentials()
  return { ok: true }
}

export async function reorderOccupation(
  id: string,
  direction: "up" | "down",
): Promise<ReferentialResult> {
  await requireRole("admin")
  if (!isUuid(id) || (direction !== "up" && direction !== "down")) {
    return notFound
  }
  if (!(await moveOccupation(id, direction))) return notFound
  revalidateReferentials()
  return { ok: true }
}

export type ExcludeDomainResult =
  | {
      ok: true
      domain: string
      created: boolean
      // Annonces publiées qui y mènent : la fiche masque déjà ces liens ; à corriger.
      affected: AffectedOffer[]
    }
  | {
      ok: false
      fieldErrors: Partial<Record<"domain" | "reason", string[]>>
    }

export async function excludeDomain(
  values: unknown,
): Promise<ExcludeDomainResult> {
  await requireRole("admin")
  const parsed = blockedDomainSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const { domain, reason } = parsed.data
  const created = await addBlockedDomain(domain, reason)
  revalidateReferentials()
  return {
    ok: true,
    domain,
    created,
    affected: await publishedOffersPointingTo([domain]),
  }
}

// Le domaine redevient accepté dans les annonces, comme destination et comme source.
export async function allowDomain(domain: string): Promise<ReferentialResult> {
  await requireRole("admin")
  if (!(await removeBlockedDomain(String(domain)))) {
    return { ok: false, message: "Ce domaine n'est déjà plus exclu." }
  }
  revalidateReferentials()
  return { ok: true }
}
