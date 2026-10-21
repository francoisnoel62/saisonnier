"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  contactSchema,
  contactTopicLabels,
  handleContactSchema,
  HONEYPOT_FIELD,
  isRateLimited,
} from "@/domain/contact"
import { getSession, requireRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { contactMessages } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email/send"
import { contactNotificationEmail } from "@/lib/email/templates"
import { env } from "@/lib/env"

import { countRecentMessages } from "./messages"

export type ContactField =
  "topic" | "name" | "email" | "companyName" | "phone" | "message"

export type ContactState = {
  sent?: boolean
  message?: string
  fieldErrors?: Partial<Record<ContactField, string[]>>
  // Réaffichées après une erreur.
  values?: Record<ContactField | "offerId", string>
}

// Page publique : la session n'est qu'un plus (préremplissage, rattachement au compte).
export async function sendContactMessage(
  _state: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const text = (name: string) => String(formData.get(name) ?? "")
  const values = {
    topic: text("topic"),
    name: text("name"),
    email: text("email"),
    companyName: text("companyName"),
    phone: text("phone"),
    message: text("message"),
    offerId: text("offerId"),
  }

  // Champ piège rempli : on fait croire à un envoi réussi sans rien enregistrer.
  if (text(HONEYPOT_FIELD) !== "") return { sent: true }

  const parsed = contactSchema.safeParse(values)
  if (!parsed.success) {
    const { fieldErrors, formErrors } = z.flattenError(parsed.error)
    return {
      fieldErrors,
      message: formErrors[0],
      values,
    }
  }

  const input = parsed.data
  if (isRateLimited(await countRecentMessages(input.email))) {
    return {
      message:
        "Vous avez déjà envoyé plusieurs messages récemment. Réessayez dans une heure.",
      values,
    }
  }

  const session = await getSession()
  const [saved] = await db
    .insert(contactMessages)
    .values({ ...input, userId: session?.user.id })
    .returning({ id: contactMessages.id })

  // Le message est enregistré : un échec d'envoi ne doit pas le faire perdre à l'expéditeur.
  try {
    await sendEmail({
      to: env.ADMIN_NOTIFICATION_EMAIL,
      replyTo: input.email,
      ...contactNotificationEmail({
        topic: contactTopicLabels[input.topic],
        name: input.name,
        email: input.email,
        companyName: input.companyName,
        phone: input.phone,
        message: input.message,
        url: `${env.BETTER_AUTH_URL}/admin/demandes`,
      }),
    })
  } catch (error) {
    console.error(`Notification du message ${saved.id} impossible`, error)
  }

  revalidatePath("/admin/demandes")
  return { sent: true }
}

export type HandleState = { message?: string; done?: boolean }

export async function markContactHandled(
  _state: HandleState,
  formData: FormData,
): Promise<HandleState> {
  await requireRole("admin")

  const parsed = handleContactSchema.safeParse({
    id: formData.get("id"),
    adminNote: formData.get("adminNote") ?? "",
  })
  if (!parsed.success) {
    return { message: z.prettifyError(parsed.error) }
  }

  const { id, adminNote } = parsed.data
  const updated = await db
    .update(contactMessages)
    .set({ status: "handled", adminNote, handledAt: new Date() })
    .where(and(eq(contactMessages.id, id), eq(contactMessages.status, "new")))
    .returning({ id: contactMessages.id })

  revalidatePath("/admin/demandes")
  if (updated.length === 0) {
    return { message: "Ce message est déjà traité ou n'existe plus." }
  }
  return { done: true }
}
