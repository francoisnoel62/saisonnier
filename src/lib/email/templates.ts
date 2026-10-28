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

// Notification au fondateur : tout le contenu vient d'un visiteur, d'où l'échappement du gabarit.
export function contactNotificationEmail({
  topic,
  name,
  email,
  companyName,
  phone,
  message,
  url,
}: {
  topic: string
  name: string
  email: string
  companyName?: string
  phone?: string
  message: string
  url: string
}): Template {
  const greeting = "Nouveau message de contact."
  const details = [
    `Sujet : ${topic}`,
    `De : ${name} <${email}>`,
    ...(companyName ? [`Entreprise : ${companyName}`] : []),
    ...(phone ? [`Téléphone : ${phone}`] : []),
  ]
  const footer = "Répondre à cet email écrit directement à l'expéditeur."

  return {
    subject: `Nouveau message — ${topic}`,
    text: `${greeting}\n\n${details.join("\n")}\n\n${message}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: [...details, message],
      action: { label: "Ouvrir la boîte de réception", url },
      footer,
    }),
  }
}

// Demande de prestation d'un employeur (§7), traitée à la main par le fondateur.
export function serviceRequestNotificationEmail({
  name,
  email,
  companyName,
  services,
  scope,
  purchaseFormat,
  message,
  url,
}: {
  name: string
  email: string
  companyName: string
  services: string[]
  scope: string
  purchaseFormat: string
  message: string | null
  url: string
}): Template {
  const greeting = `${companyName} demande une prestation.`
  const details = [
    `Demandeur : ${name} <${email}>`,
    `Prestations : ${services.join(", ")}`,
    `Portée : ${scope}`,
    `Formule : ${purchaseFormat}`,
  ]
  const footer = "Répondre à cet email écrit directement à l'employeur."

  return {
    subject: `Demande de prestation — ${companyName}`,
    text: `${greeting}\n\n${details.join("\n")}${message ? `\n\n${message}` : ""}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: message ? [...details, message] : details,
      action: { label: "Ouvrir les demandes", url },
      footer,
    }),
  }
}

// Nouveau rattachement à vérifier : prévient le fondateur (H2). Tout vient de l'employeur.
export function membershipRequestEmail({
  name,
  email,
  jobTitle,
  relationship,
  companyName,
  siren,
  activity,
  website,
  url,
}: {
  name: string
  email: string
  jobTitle: string
  relationship: string
  companyName: string
  siren: string
  activity: string
  website: string | null
  url: string
}): Template {
  const greeting = "Un employeur demande à être rattaché à son entreprise."
  const details = [
    `Déposant : ${name} <${email}>`,
    `Fonction : ${jobTitle} (${relationship})`,
    `Entreprise : ${companyName} — SIREN ${siren}`,
    `Activité : ${activity}`,
    `Site : ${website ?? "non renseigné"}`,
  ]
  const footer =
    "Ses annonces resteront en attente, invisibles des candidats, jusqu'à votre décision."

  return {
    subject: `Rattachement à vérifier — ${companyName}`,
    text: `${greeting}\n\n${details.join("\n")}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: details,
      action: { label: "Ouvrir la file de vérification", url },
      footer,
    }),
  }
}

// Rappel de validité (§6, plan 16), tous les 30 jours : le lien signé permet de répondre sans se
// connecter. Sans réponse, l'annonce reste en ligne.
export function validityReminderEmail({
  name,
  title,
  url,
}: {
  name: string
  title: string
  url: string
}): Template {
  const greeting = `Bonjour ${name},`
  const body = `Votre annonce « ${title} » est en ligne depuis un mois ou plus. Est-elle toujours valable ? Un clic suffit pour la confirmer, ou pour la retirer si le poste est pourvu.`
  const footer =
    "Le lien est valable 30 jours. Sans réponse, l'annonce reste en ligne jusqu'à son échéance ; vous pouvez aussi la gérer depuis votre espace."

  return {
    subject: `Votre annonce « ${title} » est-elle toujours valable ?`,
    text: `${greeting}\n\n${body}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: [body],
      action: { label: "Répondre", url },
      footer,
    }),
  }
}

// Décision de l'admin, envoyée à l'employeur ; un refus en donne toujours le motif.
export function membershipDecisionEmail({
  name,
  companyName,
  decision,
  reviewNote,
  url,
}: {
  name: string
  companyName: string
  decision: "verify" | "reject"
  reviewNote?: string
  url: string
}): Template {
  const greeting = `Bonjour ${name},`

  if (decision === "verify") {
    const body = `Votre rattachement à ${companyName} est vérifié. Vos annonces en attente sont publiées, et les prochaines le seront dès leur dépôt.`
    const footer = `Merci de votre confiance. — ${site.name}`
    return {
      subject: `Votre rattachement est vérifié — ${site.name}`,
      text: `${greeting}\n\n${body}\n\n${url}\n\n${footer}`,
      html: layout({
        greeting,
        paragraphs: [body],
        action: { label: "Voir mes annonces", url },
        footer,
      }),
    }
  }

  const body = `Nous n'avons pas pu vérifier votre rattachement à ${companyName}. Vos annonces ne seront pas publiées.`
  const motive = `Motif : ${reviewNote}`
  const footer =
    "Une erreur ? Répondez-nous par le formulaire de contact, avec les éléments qui permettent de vérifier votre lien avec l'entreprise."
  return {
    subject: `Votre rattachement n'a pas été validé — ${site.name}`,
    text: `${greeting}\n\n${body}\n\n${motive}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: [body, motive],
      action: { label: "Nous contacter", url },
      footer,
    }),
  }
}

// Bilan d'un passage du scan (SH16), envoyé une fois au fondateur : jamais un email par dossier.
export function scanRunReportEmail({
  mode,
  statusLabel,
  date,
  delivered,
  target,
  targetReachedAt,
  automaticPublications,
  blockedSources,
  suspendedSources,
  url,
}: {
  mode: "bootstrap" | "daily"
  statusLabel: string
  // Jour de Paris du passage, déjà formaté.
  date: string
  delivered: number
  target: number | null
  targetReachedAt: string | null
  automaticPublications: number
  blockedSources: string[]
  suspendedSources: string[]
  url: string
}): Template {
  const greeting =
    mode === "bootstrap"
      ? `Bilan du remplissage initial du scan (${date}).`
      : `Bilan du scan quotidien du ${date}.`
  const details = [
    `Statut : ${statusLabel}.`,
    target
      ? `Dossiers livrés pour vérification : ${delivered} / ${target}.`
      : `Dossiers livrés pour vérification : ${delivered}.`,
    ...(target
      ? [
          targetReachedAt
            ? `Seuil de ${target} atteint le ${targetReachedAt}.`
            : `Le seuil de ${target} n'est pas atteint : activez une source de réserve, puis reprenez le passage depuis l'écran du scan.`,
        ]
      : []),
    ...(automaticPublications
      ? [`Annonces publiées automatiquement : ${automaticPublications}.`]
      : []),
    ...(blockedSources.length
      ? [
          `Sources arrêtées (accès refusé ou indisponibles) : ${blockedSources.join(", ")}.`,
        ]
      : []),
    ...(suspendedSources.length
      ? [
          `Sources suspendues par le disjoncteur : ${suspendedSources.join(", ")}.`,
        ]
      : []),
  ]
  const footer = "Le détail figure dans le bilan du passage."
  return {
    subject:
      mode === "bootstrap"
        ? "Scan — bilan du remplissage initial"
        : `Scan quotidien du ${date} — bilan`,
    text: `${greeting}\n\n${details.join("\n")}\n\n${url}\n\n${footer}`,
    html: layout({
      greeting,
      paragraphs: details,
      action: { label: "Ouvrir le bilan", url },
      footer,
    }),
  }
}
