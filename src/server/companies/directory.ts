import "server-only"

import { z } from "zod"

import { COMPANY_SEARCH_MIN_LENGTH } from "@/domain/membership"
import { nafLabel } from "@/domain/naf"

// API Recherche d'entreprises (https://recherche-entreprises.api.gouv.fr) : gratuite, sans clé,
// limitée à environ 7 requêtes par seconde. Appelée côté serveur uniquement ; si elle ne répond
// pas, l'employeur saisit son entreprise à la main.

const API_URL = "https://recherche-entreprises.api.gouv.fr/search"
const TIMEOUT_MS = 5000
const RESULTS = 8

// Ce qui pré-remplit le formulaire d'onboarding.
export type CompanySuggestion = {
  legalName: string
  displayName: string | null
  siren: string
  siret: string | null
  nafCode: string | null
  nafLabel: string | null
  communeName: string | null
  address: string | null
}

const text = z.string().nullish()

const establishmentSchema = z.object({
  siret: text,
  activite_principale: text,
  libelle_commune: text,
  adresse: text,
  nom_commercial: text,
  liste_enseignes: z.array(z.string()).nullish(),
})

const responseSchema = z.object({
  results: z.array(
    z.object({
      siren: z.string(),
      nom_complet: text,
      nom_raison_sociale: text,
      activite_principale: text,
      siege: establishmentSchema.nullish(),
      matching_etablissements: z.array(establishmentSchema).nullish(),
    }),
  ),
})

type Result = z.infer<typeof responseSchema>["results"][number]

// Recherche par SIRET : l'établissement trouvé plutôt que le siège.
function toSuggestion(result: Result, query: string): CompanySuggestion {
  const establishment =
    result.matching_etablissements?.find((item) => item.siret === query) ??
    result.siege
  const nafCode =
    establishment?.activite_principale ?? result.activite_principale ?? null
  const legalName =
    result.nom_raison_sociale ?? result.nom_complet ?? result.siren
  const brand =
    establishment?.liste_enseignes?.[0] ?? establishment?.nom_commercial ?? null

  return {
    legalName,
    displayName: brand && brand !== legalName ? brand : null,
    siren: result.siren,
    siret: establishment?.siret ?? null,
    nafCode,
    nafLabel: nafLabel(nafCode),
    communeName: establishment?.libelle_commune ?? null,
    address: establishment?.adresse ?? null,
  }
}

export type DirectorySearch =
  { ok: true; results: CompanySuggestion[] } | { ok: false }

// Entreprises actives correspondant au nom ou au numéro saisi ; `ok: false` si l'API est
// indisponible, lente ou répond autre chose que prévu.
export async function searchCompanyDirectory(
  query: string,
): Promise<DirectorySearch> {
  const q = /^[\d\s]+$/.test(query) ? query.replace(/\s/g, "") : query.trim()
  if (q.length < COMPANY_SEARCH_MIN_LENGTH) return { ok: true, results: [] }

  const params = new URLSearchParams({
    q,
    per_page: String(RESULTS),
    etat_administratif: "A",
    minimal: "true",
    include: "siege,matching_etablissements",
  })
  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
    if (!response.ok) {
      console.warn(`Recherche d'entreprises : HTTP ${response.status}`)
      return { ok: false }
    }
    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) {
      console.warn("Recherche d'entreprises : réponse inattendue")
      return { ok: false }
    }
    return {
      ok: true,
      results: parsed.data.results.map((result) => toSuggestion(result, q)),
    }
  } catch (error) {
    console.warn("Recherche d'entreprises indisponible", error)
    return { ok: false }
  }
}
