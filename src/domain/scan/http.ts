export const scanFailureReasons = [
  "invalid_url",
  "blocked_address",
  "robots_disallowed",
  "timeout",
  "too_large",
  "unsupported_type",
  "too_many_redirects",
  "rate_limited",
  "access_denied",
  "not_found",
  "gone",
  "http_error",
  "network",
] as const
export type ScanFailureReason = (typeof scanFailureReasons)[number]

export const scanFailureLabels: Record<ScanFailureReason, string> = {
  invalid_url: "adresse refusée",
  blocked_address: "adresse réseau interdite",
  robots_disallowed: "interdit par robots.txt",
  timeout: "délai dépassé",
  too_large: "réponse trop volumineuse",
  unsupported_type: "type de contenu non pris en charge",
  too_many_redirects: "trop de redirections",
  rate_limited: "hôte à ménager (Retry-After)",
  access_denied: "accès refusé",
  not_found: "page introuvable",
  gone: "page supprimée",
  http_error: "erreur HTTP",
  network: "erreur réseau",
}

// Refus explicite ou hôte en panne : aucune autre lecture de la source (SH12).
// Une fiche absente, trop lourde ou d'un autre type n'arrête pas les suivantes.
const sourceStoppingReasons = new Set<ScanFailureReason>([
  "blocked_address",
  "robots_disallowed",
  "timeout",
  "rate_limited",
  "access_denied",
  "network",
])
export function stopsSource(reason: ScanFailureReason) {
  return sourceStoppingReasons.has(reason)
}

export type RobotsDecision = {
  url: string
  status?: number
  allowed: boolean
  crawlDelayMs: number
  // Motif quand robots.txt n'a pas pu être lu (l'hôte est alors indisponible).
  reason?: ScanFailureReason
}

export type ScanFailure = {
  ok: false
  reason: ScanFailureReason
  status?: number
  retryAfterMs?: number
}
export type ScanFetchOutcome =
  | {
      ok: true
      status: number
      finalUrl: string
      contentType: string
      body: string
      bytes: number
      fetchedAt: string
    }
  | (ScanFailure & { finalUrl?: string })
export type ScanFetchResult = ScanFetchOutcome & {
  robots: RobotsDecision[]
  // Durée des échanges HTTP, robots.txt et redirections compris.
  elapsedMs: number
  // Attente de politesse (intervalle, Crawl-delay, Retry-After), hors échanges.
  waitedMs: number
}
