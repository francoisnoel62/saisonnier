import { z } from "zod"

export const contactTopics = [
  "collected_offer",
  "employer",
  "candidate",
  "other",
] as const

export type ContactTopic = (typeof contactTopics)[number]

export const contactTopicLabels: Record<ContactTopic, string> = {
  collected_offer: "À propos d'une annonce collectée",
  employer: "Je suis employeur",
  candidate: "Je suis candidat",
  other: "Autre demande",
}

// Valeur du paramètre `?motif=` de /contact.
const topicSlugs: Record<string, ContactTopic> = {
  "annonce-collectee": "collected_offer",
  employeur: "employer",
  candidat: "candidate",
  autre: "other",
}

export function topicFromSlug(slug: string | undefined): ContactTopic {
  return slug && Object.hasOwn(topicSlugs, slug) ? topicSlugs[slug] : "other"
}

export const contactStatuses = ["new", "handled"] as const

export type ContactStatus = (typeof contactStatuses)[number]

export const contactStatusLabels: Record<ContactStatus, string> = {
  new: "Nouveau",
  handled: "Traité",
}

export const MESSAGE_MAX_LENGTH = 3000
export const ADMIN_NOTE_MAX_LENGTH = 1000
// Anti-abus : messages acceptés par adresse email sur une heure glissante.
export const MESSAGES_PER_HOUR = 3

// Champ piège : invisible pour une personne, rempli par les robots.
export const HONEYPOT_FIELD = "hp_url"

// Un champ facultatif laissé vide devient `undefined`.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || undefined)

export const contactSchema = z.object({
  topic: z.enum(contactTopics, "Choisissez un sujet."),
  name: z
    .string()
    .trim()
    .min(1, "Indiquez votre nom.")
    .max(100, "Le nom ne doit pas dépasser 100 caractères."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Saisissez une adresse email valide.")),
  companyName: optionalText(
    150,
    "Le nom de l'entreprise ne doit pas dépasser 150 caractères.",
  ),
  phone: optionalText(30, "Le téléphone ne doit pas dépasser 30 caractères."),
  message: z
    .string()
    .trim()
    .min(1, "Écrivez votre message.")
    .max(
      MESSAGE_MAX_LENGTH,
      `Le message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères.`,
    ),
  // Annonce concernée, transmise par le lien « Contacter le fondateur » d'une fiche.
  offerId: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(z.uuid().optional()),
})

export type ContactInput = z.infer<typeof contactSchema>

// `recentCount` : messages déjà enregistrés pour cette adresse durant la dernière heure.
export function isRateLimited(recentCount: number) {
  return recentCount >= MESSAGES_PER_HOUR
}

export const handleContactSchema = z.object({
  id: z.uuid(),
  adminNote: optionalText(
    ADMIN_NOTE_MAX_LENGTH,
    `La note ne doit pas dépasser ${ADMIN_NOTE_MAX_LENGTH} caractères.`,
  ),
})
