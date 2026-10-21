import { site } from "@/config/site"

import type { Email } from "./send"

type Template = Omit<Email, "to">

// Le nom est saisi par l'utilisateur : il est échappé avant d'entrer dans le HTML.
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function layout({
  greeting,
  paragraphs,
  action,
  footer,
}: {
  greeting: string
  paragraphs: string[]
  action: { label: string; url: string }
  footer: string
}) {
  const p = (text: string) =>
    `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5">
    <div style="max-width:480px;margin:0 auto;padding:24px;background:#ffffff;border-radius:8px">
      <p style="margin:0 0 24px;font-weight:bold">${escapeHtml(site.name)}</p>
      ${p(greeting)}
      ${paragraphs.map(p).join("\n      ")}
      <p style="margin:24px 0">
        <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:#171717;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(action.label)}</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#525252">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(action.url)}" style="color:#525252;word-break:break-all">${escapeHtml(action.url)}</a></p>
      <p style="margin:0;font-size:13px;color:#525252">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`
}

export function verificationEmail({
  name,
  url,
}: {
  name: string
  url: string
}): Template {
  const greeting = `Bonjour ${name},`
  const body = `Pour activer votre compte ${site.name}, confirmez votre adresse email. Le lien est valable une heure.`
  const footer =
    "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet email."

  return {
    subject: `Confirmez votre adresse email — ${site.name}`,
    text: `${greeting}\n\n${body}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: [body],
      action: { label: "Confirmer mon adresse email", url },
      footer,
    }),
  }
}

export function resetPasswordEmail({
  name,
  url,
}: {
  name: string
  url: string
}): Template {
  const greeting = `Bonjour ${name},`
  const body = `Vous avez demandé à réinitialiser le mot de passe de votre compte ${site.name}. Le lien est valable une heure.`
  const footer =
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email : votre mot de passe reste inchangé."

  return {
    subject: `Réinitialisation de votre mot de passe — ${site.name}`,
    text: `${greeting}\n\n${body}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: [body],
      action: { label: "Choisir un nouveau mot de passe", url },
      footer,
    }),
  }
}
