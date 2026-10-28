import { z } from "zod"

import { franceTravailOrigin } from "./adapter-catalog"

// Recherche France Travail structurée (§8.1) : le formulaire expose les filtres de la recherche
// publique et reconstruit l'URL, paramètres triés ; la pagination (`range`) reste au connecteur.
export const franceTravailEmissions = ["1", "3", "7", "14", "31"] as const
export const franceTravailEmissionLabels: Record<
  (typeof franceTravailEmissions)[number],
  string
> = {
  "1": "Un jour",
  "3": "Trois jours",
  "7": "Une semaine",
  "14": "Deux semaines",
  "31": "Un mois",
}
export const franceTravailSorts = ["0", "1"] as const
export const franceTravailSortLabels: Record<
  (typeof franceTravailSorts)[number],
  string
> = { "0": "Pertinence", "1": "Date de création" }

const codes = (pattern: string, message: string) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^(?:${pattern})(?:,(?:${pattern}))*$`), message)
export const franceTravailSearchSchema = z.object({
  motsCles: z.string().trim().max(100).optional(),
  domaine: codes(
    "[A-N]",
    "Domaine professionnel : une lettre de A à N.",
  ).optional(),
  typeContrat: codes(
    "[A-Z]{3}",
    "Type de contrat : codes de trois lettres (ex. SAI).",
  ).optional(),
  lieux: codes(
    "[0-9]{5}|[0-9]{2}D|[0-9]{2}R|2[AB]D?",
    "Lieu : code INSEE, département (74D), région (84R) ou France (99100).",
  ).optional(),
  rayon: z
    .string()
    .regex(/^(?:[0-9]|[1-9][0-9]|100)$/, "Rayon en kilomètres, de 0 à 100.")
    .optional(),
  emission: z.enum(franceTravailEmissions).optional(),
  offresPartenaires: z.boolean(),
  tri: z.enum(franceTravailSorts).optional(),
})
export type FranceTravailSearch = z.infer<typeof franceTravailSearchSchema>
const searchKeys = [
  "domaine",
  "emission",
  "lieux",
  "motsCles",
  "offresPartenaires",
  "range",
  "rayon",
  "tri",
  "typeContrat",
] as const

export function franceTravailSearchUrl(search: FranceTravailSearch) {
  const values: Record<string, string | undefined> = {
    ...search,
    offresPartenaires: String(search.offresPartenaires),
    range: "0-19",
  }
  const params = new URLSearchParams()
  for (const key of searchKeys) {
    const value = values[key]
    if (value) params.set(key, value)
  }
  // Listes de codes séparées par des virgules, lisibles comme sur le site.
  return `${franceTravailOrigin}/offres/recherche?${params.toString().replace(/%2C/g, ",")}`
}

// Recherche structurée d'une URL de la recherche publique ; null si un paramètre n'y a pas de
// place (la recherche ne serait pas reconstruite à l'identique).
export function parseFranceTravailSearchUrl(
  value: string,
): FranceTravailSearch | null {
  try {
    const url = new URL(value)
    if (
      url.origin !== franceTravailOrigin ||
      url.pathname !== "/offres/recherche" ||
      url.hash
    )
      return null
    const raw: Record<string, unknown> = {}
    for (const [key, item] of url.searchParams) {
      if (!(searchKeys as readonly string[]).includes(key) || key in raw)
        return null
      if (key !== "range") raw[key] = item
    }
    if (raw.offresPartenaires !== undefined) {
      if (raw.offresPartenaires !== "true" && raw.offresPartenaires !== "false")
        return null
      raw.offresPartenaires = raw.offresPartenaires === "true"
    } else raw.offresPartenaires = true
    const parsed = franceTravailSearchSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// Avertissement affiché quand les offres partenaires sont incluses.
export const partnerOffersWarning =
  "Les offres partenaires viennent d'autres diffuseurs : elles multiplient les doublons et les sources à vérifier."
