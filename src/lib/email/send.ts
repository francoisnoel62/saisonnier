import { Resend } from "resend"

import { site } from "@/config/site"
import { env } from "@/lib/env"

export type Email = {
  to: string
  subject: string
  text: string
  html: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

// Sans clé Resend (en local, en test), l'email s'affiche dans la console : liens compris.
export async function sendEmail({ to, subject, text, html }: Email) {
  if (!resend) {
    console.info(
      `\n──── Email (console) ────\nÀ : ${to}\nObjet : ${subject}\n\n${text}\n─────────────────────────\n`,
    )
    return
  }

  const { error } = await resend.emails.send({
    from: `${site.name} <${env.EMAIL_FROM}>`,
    to,
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
