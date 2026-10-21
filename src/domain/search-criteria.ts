import { z } from "zod"

import { isIsoDate } from "./offer-activity"
import { salaryBases } from "./salary"

// Critères de la recherche d'offres (§4). Tous sont facultatifs et se combinent : une offre doit
// les satisfaire tous. Un critère absent, une liste vide ou un interrupteur à `false` n'impose
// aucune restriction. Les règles de correspondance sont dans offer-matching.ts.

// Temps de travail recherché (H7) : « Non précisé » n'est pas un choix de filtre.
export const searchWorkTimes = ["full_time", "part_time"] as const
export type SearchWorkTime = (typeof searchWorkTimes)[number]

// Borne des listes : une URL fabriquée ne doit pas produire une requête démesurée.
const MAX_LIST = 100

const list = (pattern: RegExp, message: string) =>
  z.array(z.string().regex(pattern, message)).max(MAX_LIST).optional()

const isoDate = z
  .string()
  .refine(isIsoDate, "Date attendue au format AAAA-MM-JJ.")
  .optional()

export const searchCriteriaSchema = z
  .object({
    // Métiers du référentiel, par slug.
    occupations: list(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Métier inconnu."),
    // Codes du COG INSEE : une offre est retenue si son département, ou sa région, est choisi.
    regions: list(/^\d{2}$/, "Région inconnue."),
    departments: list(/^(\d{2}|2[AB]|97\d)$/, "Département inconnu."),
    // Disponibilité du candidat (H4).
    availableFrom: isoDate,
    availableTo: isoDate,
    flexibleDates: z.boolean().optional(),
    // H5 : la base choisie, puis un minimum mensuel en euros. Sans minimum, la base seule ne
    // restreint rien.
    salaryBasis: z.enum(salaryBases).optional(),
    salaryMinMonthly: z.number().int().positive().max(100_000).optional(),
    housing: z.boolean().optional(),
    meals: z.boolean().optional(),
    // H8 : « Débutants acceptés ».
    beginnersWelcome: z.boolean().optional(),
    // H6 : codes ISO 639-1 des langues que le candidat parle.
    spokenLanguages: list(/^[a-z]{2}$/, "Code de langue inconnu."),
    workTime: z.enum(searchWorkTimes).optional(),
    // H8 : « Permis non exigé ».
    noLicenseRequired: z.boolean().optional(),
    couplesWelcome: z.boolean().optional(),
    petsAllowed: z.boolean().optional(),
  })
  .refine(
    (c) =>
      !c.availableFrom || !c.availableTo || c.availableFrom <= c.availableTo,
    {
      message: "La date de fin de disponibilité précède celle de début.",
      path: ["availableTo"],
    },
  )
  // Un seuil sans base comparerait un brut à un net (§4).
  .refine((c) => c.salaryMinMonthly === undefined || c.salaryBasis, {
    message: "Choisissez net ou brut avant d'indiquer un minimum.",
    path: ["salaryBasis"],
  })

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>
