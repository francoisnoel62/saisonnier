import { z } from "zod"

// Prestations proposées aux employeurs (§7, H15) : définies, sur devis, traitées à la main par le
// fondateur. Ni tarif, ni paiement, ni questionnaire en ligne ; aucune n'est exigée pour publier.

export const serviceKinds = [
  "questionnaire",
  "screening",
  "human_selection",
  "candidate_contact",
  "sourcing",
] as const
export type ServiceKind = (typeof serviceKinds)[number]

export const serviceKindDetails: Record<
  ServiceKind,
  { label: string; description: string }
> = {
  questionnaire: {
    label: "Questionnaire préalable",
    description:
      "Quelques questions définies avec vous, posées aux candidats avant tout échange : disponibilités, logement, expérience.",
  },
  screening: {
    label: "Tri selon les critères du poste",
    description:
      "Les candidatures sont classées selon les critères que vous fixez. Une incompatibilité est signalée, jamais rejetée automatiquement.",
  },
  human_selection: {
    label: "Sélection humaine",
    description:
      "Une personne du service lit chaque candidature et vous présente une sélection argumentée.",
  },
  candidate_contact: {
    label: "Prise de contact et confirmation de l'intérêt",
    description:
      "Le service contacte les candidats retenus et confirme leur intérêt et leurs disponibilités avant de vous les transmettre.",
  },
  sourcing: {
    label: "Recherche proactive et sourcing",
    description:
      "Le service recherche des candidats au-delà des candidatures reçues, sans jamais puiser dans les CV privés des inscrits.",
  },
}

// Prestations pour lesquelles le service reçoit les candidatures : l'annonce passe alors sur le
// canal « chargé de recrutement » (et, si l'employeur le souhaite, en anonyme), depuis le
// back-office (plan 15).
export const intermediatedServices: readonly ServiceKind[] = [
  "questionnaire",
  "screening",
  "human_selection",
  "candidate_contact",
]

export function involvesIntermediation(services: readonly ServiceKind[]) {
  return services.some((service) => intermediatedServices.includes(service))
}

// Portée de la demande : une annonce de l'employeur, une campagne, ou un établissement.
export const serviceScopes = ["offer", "campaign", "establishment"] as const
export type ServiceScope = (typeof serviceScopes)[number]

export const serviceScopeLabels: Record<ServiceScope, string> = {
  offer: "Une de mes annonces",
  campaign: "Une campagne de recrutement",
  establishment: "Un établissement",
}

export const purchaseFormats = ["single", "package"] as const
export type PurchaseFormat = (typeof purchaseFormats)[number]

export const purchaseFormatLabels: Record<PurchaseFormat, string> = {
  single: "À l'unité",
  package: "En package",
}

export const serviceRequestStatuses = [
  "new",
  "in_progress",
  "done",
  "cancelled",
] as const
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number]

export const serviceRequestStatusLabels: Record<ServiceRequestStatus, string> =
  {
    new: "Nouvelle",
    in_progress: "En cours",
    done: "Terminée",
    cancelled: "Annulée",
  }

// Engagements affichés avec les prestations (§7).
export const serviceCommitments = [
  "Des prestations définies, sans garantie d'embauche.",
  "Aucun achat n'est nécessaire pour publier une annonce conforme.",
  "Des tarifs sur devis, après échange avec vous.",
  "Un anonymat complet de l'entreprise seulement quand le service assure l'intermédiation.",
  "Des incompatibilités signalées, sans rejet automatique des candidatures.",
  "Les CV privés des inscrits ne servent jamais de base de sourcing.",
] as const

export const SCOPE_DETAILS_MAX_LENGTH = 500
export const SERVICE_MESSAGE_MAX_LENGTH = 3000
export const SERVICE_NOTE_MAX_LENGTH = 1000

// Un texte facultatif laissé vide devient null.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)

const isOneOf = <T extends string>(
  values: readonly T[],
  value: string,
): value is T => (values as readonly string[]).includes(value)

const isServiceKind = (value: string): value is ServiceKind =>
  isOneOf(serviceKinds, value)

// Demande d'un employeur. Une annonce est précisée par la liste ; une campagne ou un
// établissement, par un texte. Les choix sont des textes contrôlés un à un : la règle qui lie la
// portée à ses précisions s'exécute même si un autre champ est invalide, et toutes les erreurs
// s'affichent ensemble.
export const serviceRequestSchema = z
  .object({
    services: z
      .array(z.string())
      .refine((values) => values.every(isServiceKind), "Prestation inconnue.")
      .transform((values) =>
        serviceKinds.filter((kind) => values.includes(kind)),
      )
      .refine((values) => values.length > 0, "Cochez au moins une prestation."),
    scope: z
      .string()
      .refine(
        (value) => isOneOf(serviceScopes, value),
        "Précisez la portée de la demande.",
      ),
    offerId: z.string().trim(),
    scopeDetails: optionalText(
      SCOPE_DETAILS_MAX_LENGTH,
      `Les précisions ne doivent pas dépasser ${SCOPE_DETAILS_MAX_LENGTH} caractères.`,
    ),
    purchaseFormat: z
      .string()
      .refine(
        (value) => isOneOf(purchaseFormats, value),
        "Choisissez une formule : à l'unité ou en package.",
      ),
    message: optionalText(
      SERVICE_MESSAGE_MAX_LENGTH,
      `Le message ne doit pas dépasser ${SERVICE_MESSAGE_MAX_LENGTH} caractères.`,
    ),
  })
  .superRefine((input, ctx) => {
    if (input.scope === "offer" && !z.uuid().safeParse(input.offerId).success) {
      ctx.addIssue({
        code: "custom",
        path: ["offerId"],
        message: "Choisissez l'annonce concernée.",
      })
    }
    const needsDetails =
      input.scope === "campaign" || input.scope === "establishment"
    if (needsDetails && !input.scopeDetails) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeDetails"],
        message:
          input.scope === "campaign"
            ? "Précisez la campagne : postes, nombre de recrutements, période."
            : "Précisez l'établissement concerné.",
      })
    }
  })
  // L'annonce ne vaut que pour la portée « une de mes annonces ».
  .transform((input) => ({
    ...input,
    scope: input.scope as ServiceScope,
    offerId: input.scope === "offer" ? input.offerId : null,
    purchaseFormat: input.purchaseFormat as PurchaseFormat,
  }))

export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>

// Traitement par l'admin : le statut, et une note interne que l'employeur ne voit pas.
export const serviceRequestUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(serviceRequestStatuses, "Statut inconnu."),
  adminNote: optionalText(
    SERVICE_NOTE_MAX_LENGTH,
    `La note ne doit pas dépasser ${SERVICE_NOTE_MAX_LENGTH} caractères.`,
  ),
})
