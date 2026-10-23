// Recherche choisie par le fondateur le 23/10/2026 : conserver tous les filtres.
export const franceTravailSearchUrl =
  "https://candidat.francetravail.fr/offres/recherche?domaine=G&emission=3&lieux=99100&offresPartenaires=false&range=0-19&rayon=10&tri=1&typeContrat=SAI"

export function franceTravailListUrl(page = 0) {
  if (!Number.isInteger(page) || page < 0 || page >= 20)
    throw new Error("Page France Travail hors limites.")
  const url = new URL(franceTravailSearchUrl)
  url.searchParams.set("range", `${page * 20}-${page * 20 + 19}`)
  return url.href
}

// Le HTML de détail charge un composant ; ses données publiques sont servies en JSON
// sur cette même origine. Aucune authentification ni API partenaire n'est utilisée.
export function franceTravailPostingDataUrl(pageUrl: string) {
  try {
    const url = new URL(pageUrl)
    if (
      url.origin !== "https://candidat.francetravail.fr" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null
    const match = /^\/offres\/recherche\/detail\/([A-Z0-9]+)\/?$/.exec(
      url.pathname,
    )
    return match ? `${url.origin}/api-descriptifoffre/offre/${match[1]}` : null
  } catch {
    return null
  }
}
