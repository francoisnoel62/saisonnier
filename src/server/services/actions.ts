"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  purchaseFormatLabels,
  serviceKindDetails,
  serviceRequestSchema,
  serviceRequestUpdateSchema,
  serviceScopeLabels,
} from "@/domain/service-request"
import { requireRole } from "@/lib/dal"
import { sendEmail } from "@/lib/email/send"
import { serviceRequestNotificationEmail } from "@/lib/email/templates"
import { env } from "@/lib/env"
import { getMembership } from "@/server/companies/membership"
import { managerOf } from "@/server/offers/employer-offers"

import { createServiceRequest, updateServiceRequest } from "./requests"

export type ServiceRequestField =
  | "services"
  | "scope"
  | "offerId"
  | "scopeDetails"
  | "purchaseFormat"
  | "message"

export type ServiceRequestState = {
  sent?: boolean
  message?: string
  fieldErrors?: Partial<Record<ServiceRequestField, string[]>>
  // Réaffichées après une erreur.
  values?: {
    services: string[]
    scope: string
    offerId: string
    scopeDetails: string
    purchaseFormat: string
    message: string
  }
}

// Demande de prestation d'un employeur rattaché (§7) : enregistrée, puis notifiée au fondateur.
// Aucune n'est exigée pour publier une annonce.
export async function requestServices(
  _state: ServiceRequestState,
  formData: FormData,
): Promise<ServiceRequestState> {
  const { user } = await requireRole("employer")
  const text = (name: string) => String(formData.get(name) ?? "")
  const values = {
    services: formData.getAll("services").map(String),
    scope: text("scope"),
    offerId: text("offerId"),
    scopeDetails: text("scopeDetails"),
    purchaseFormat: text("purchaseFormat"),
    message: text("message"),
  }

  const membership = await getMembership(user.id)
  if (!membership) {
    return {
      message: "Rattachez d'abord votre compte à votre entreprise.",
      values,
    }
  }
  if (membership.member.status === "rejected") {
    return {
      message:
        "Votre rattachement a été refusé : contactez-nous pour toute demande.",
      values,
    }
  }

  const parsed = serviceRequestSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const input = parsed.data
  const result = await createServiceRequest(managerOf(membership), input)
  if (!result.ok) {
    return { fieldErrors: { offerId: [result.message] }, values }
  }

  // La demande est enregistrée : un échec d'envoi ne doit pas la faire perdre.
  const { company } = membership
  try {
    await sendEmail({
      to: env.ADMIN_NOTIFICATION_EMAIL,
      replyTo: user.email,
      ...serviceRequestNotificationEmail({
        name: user.name,
        email: user.email,
        companyName: company.displayName ?? company.legalName,
        services: input.services.map(
          (service) => serviceKindDetails[service].label,
        ),
        scope: result.offerTitle
          ? `${serviceScopeLabels.offer} — « ${result.offerTitle} »`
          : `${serviceScopeLabels[input.scope]} — ${input.scopeDetails ?? ""}`,
        purchaseFormat: purchaseFormatLabels[input.purchaseFormat],
        message: input.message,
        url: `${env.BETTER_AUTH_URL}/admin/demandes?onglet=prestations`,
      }),
    })
  } catch (error) {
    console.error(
      `Notification de la demande de prestation ${result.request.id} impossible`,
      error,
    )
  }

  revalidatePath("/employeur/prestations")
  revalidatePath("/admin", "layout")
  return { sent: true }
}

export type ServiceRequestUpdateState = { message?: string; done?: boolean }

// Traitement manuel par le fondateur : statut et note interne.
export async function updateServiceRequestAction(
  _state: ServiceRequestUpdateState,
  formData: FormData,
): Promise<ServiceRequestUpdateState> {
  await requireRole("admin")
  const parsed = serviceRequestUpdateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote") ?? "",
  })
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Mise à jour invalide.",
    }
  }

  const { id, ...update } = parsed.data
  const updated = await updateServiceRequest(id, update)
  revalidatePath("/admin", "layout")
  revalidatePath("/employeur/prestations")
  if (!updated) return { message: "Cette demande n'existe plus." }
  return { done: true }
}
