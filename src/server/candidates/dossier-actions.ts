"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  applicationMessageSchema,
  contactDetailsSchema,
  documentKinds,
  type DocumentKind,
} from "@/domain/candidate-dossier"
import { requireRole } from "@/lib/dal"
import { deletePrivateDocument } from "@/server/storage/documents"

import {
  saveApplicationMessage,
  saveContactDetails,
  setDocument,
} from "./dossier"

// Le dossier modifié change aussi la bannière de /offres et le panneau de candidature.
function revalidateDossier() {
  revalidatePath("/dossier")
  revalidatePath("/offres", "layout")
}

export type ContactDetailsField = "name" | "phone" | "city"

export type FormState<Field extends string> = {
  saved?: boolean
  message?: string
  fieldErrors?: Partial<Record<Field, string[]>>
  // Réaffichées après une erreur.
  values?: Partial<Record<Field, string>>
}

export async function updateContactDetails(
  _state: FormState<ContactDetailsField>,
  formData: FormData,
): Promise<FormState<ContactDetailsField>> {
  const { user } = await requireRole("candidate")
  const values = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
  }

  const parsed = contactDetailsSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }
  await saveContactDetails(user.id, parsed.data)
  revalidateDossier()
  return { saved: true }
}

export async function updateApplicationMessage(
  _state: FormState<"applicationMessage">,
  formData: FormData,
): Promise<FormState<"applicationMessage">> {
  const { user } = await requireRole("candidate")
  const values = {
    applicationMessage: String(formData.get("applicationMessage") ?? ""),
  }

  const parsed = applicationMessageSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }
  await saveApplicationMessage(user.id, parsed.data.applicationMessage)
  revalidateDossier()
  return { saved: true }
}

// Retire un document du dossier, puis du stockage.
export async function deleteDocument(kind: DocumentKind) {
  const { user } = await requireRole("candidate")
  if (!documentKinds.includes(kind)) throw new Error("Document inconnu.")

  const previous = await setDocument(user.id, kind, null)
  if (previous) await deletePrivateDocument(previous)
  revalidateDossier()
}
