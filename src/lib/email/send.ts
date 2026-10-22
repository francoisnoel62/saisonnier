import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { Resend } from "resend"

import { site } from "@/config/site"
import { env } from "@/lib/env"

export type Email = {
  to: string
  // Adresse de réponse (ex. l'expéditeur d'un message de contact).
  replyTo?: string
  subject: string
  text: string
  html: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

// Sans clé Resend (en local, en test), l'email s'affiche dans la console : liens compris.
export async function sendEmail({ to, replyTo, subject, text, html }: Email) {
  if (!resend) {
    console.info(
      `\n──── Email (console) ────\nÀ : ${to}\nObjet : ${subject}\n\n${text}\n─────────────────────────\n`,
    )
    if (env.EMAIL_OUTBOX_DIR) {
      await mkdir(env.EMAIL_OUTBOX_DIR, { recursive: true })
      await writeFile(
        path.join(env.EMAIL_OUTBOX_DIR, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({ to, replyTo, subject, text }),
      )
    }
    return
  }

  const { error } = await resend.emails.send({
    from: `${site.name} <${env.EMAIL_FROM}>`,
    to,
    replyTo,
    subject,
    text,
    html,
  })
  if (error) {
    throw new Error(
      `Envoi de l'email « ${subject} » impossible : ${error.message}`,
    )
  }
}
