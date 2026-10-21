import { z } from "zod"

// Dossier du candidat (§5) : coordonnées, CV, lettre et message facultatifs. Les documents sont
// privés (§7, H11) : seul leur propriétaire les télécharge, aucun n'est envoyé à sa place.

// Documents du dossier, et leur nom dans les URL (/api/dossier/documents?type=lettre).
export const documentKinds = ["cv", "cover_letter"] as const
export type DocumentKind = (typeof documentKinds)[number]

export const documentSlugs: Record<DocumentKind, string> = {
  cv: "cv",
  cover_letter: "lettre",
}

export function documentKindFromSlug(slug: string | null | undefined) {
  return documentKinds.find((kind) => documentSlugs[kind] === slug) ?? null
}

export const documentLabels: Record<DocumentKind, string> = {
  cv: "CV",
  cover_letter: "Lettre de motivation",
}

// Sous la limite de 4,5 Mo du corps d'une requête vers une fonction Vercel.
export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024
export const APPLICATION_MESSAGE_MAX_LENGTH = 2000

// Signature des fichiers PDF : « %PDF- » en tête du fichier.
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

export type DocumentProblem = {
  reason: "empty" | "too_large" | "not_pdf"
  message: string
}

// Motif du refus d'un document envoyé, ou null s'il est accepté : un PDF (type déclaré et
// signature), non vide, de 4 Mo au plus.
export function checkPdfDocument(file: {
  type: string
  size: number
  head: Uint8Array
}): DocumentProblem | null {
  if (file.size === 0) {
    return { reason: "empty", message: "Le fichier est vide." }
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return {
      reason: "too_large",
      message:
        "Le fichier dépasse 4 Mo : réduisez sa taille avant de l'envoyer.",
    }
  }
  const isPdf =
    file.type === "application/pdf" &&
    PDF_SIGNATURE.every((byte, index) => file.head[index] === byte)
  return isPdf
    ? null
    : { reason: "not_pdf", message: "Seuls les fichiers PDF sont acceptés." }
}

// Ce qui doit figurer au dossier avant la première candidature (H3).
export type DossierRequirement = "name" | "phone" | "cv"

export const dossierRequirementLabels: Record<DossierRequirement, string> = {
  name: "votre nom",
  phone: "votre numéro de téléphone",
  cv: "votre CV (PDF)",
}

const filled = (value: string | null | undefined) => !!value?.trim()

// H3 : dossier complet = nom + téléphone + CV. Les coordonnées de candidature ne sont montrées
// qu'à un dossier complet (plan 11).
export function dossierStatus(dossier: {
  name?: string | null
  phone?: string | null
  cvPathname?: string | null
}): { complete: boolean; missing: DossierRequirement[] } {
  const missing: DossierRequirement[] = []
  if (!filled(dossier.name)) missing.push("name")
  if (!filled(dossier.phone)) missing.push("phone")
  if (!filled(dossier.cvPathname)) missing.push("cv")
  return { complete: missing.length === 0, missing }
}

// Un champ facultatif laissé vide devient null : un texte absent s'écrit NULL, jamais ''.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)

// Chiffres, espaces et « + . - ( ) », au moins 9 chiffres : les numéros français comme étrangers.
const PHONE = /^\+?[\d\s.()-]+$/

export const contactDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Indiquez votre nom.")
    .max(100, "Le nom ne doit pas dépasser 100 caractères."),
  phone: optionalText(
    30,
    "Le téléphone ne doit pas dépasser 30 caractères.",
  ).refine(
    (phone) =>
      phone === null ||
      (PHONE.test(phone) && phone.replace(/\D/g, "").length >= 9),
    "Saisissez un numéro de téléphone valide.",
  ),
  city: optionalText(100, "La ville ne doit pas dépasser 100 caractères."),
})

export type ContactDetails = z.infer<typeof contactDetailsSchema>

export const applicationMessageSchema = z.object({
  applicationMessage: optionalText(
    APPLICATION_MESSAGE_MAX_LENGTH,
    `Le message ne doit pas dépasser ${APPLICATION_MESSAGE_MAX_LENGTH} caractères.`,
  ),
})

// Nom de fichier affiché et proposé au téléchargement : sans chemin, sans caractère de contrôle.
export function displayFilename(name: string, kind: DocumentKind) {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f"]/g, "")
    .trim()
    .slice(0, 150)
  return base || `${documentSlugs[kind]}.pdf`
}
