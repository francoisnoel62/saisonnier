const SIGN_IN_PATH = "/connexion"

// En-tête posé par le proxy : la page demandée, que la DAL renvoie à la connexion si la session
// a expiré.
export const REQUEST_PATH_HEADER = "x-request-path"

// N'accepte qu'un chemin interne ("/offres?x=1") : jamais "//autre.site", "https://…" ni "/\autre.site".
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null

  const base = "http://localhost"
  try {
    const url = new URL(value, base)
    if (url.origin !== base) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

// Page de connexion, avec la page demandée en retour après connexion.
export function signInPath(next?: string | null) {
  const path = safeNextPath(next)
  return path && path !== "/"
    ? `${SIGN_IN_PATH}?${new URLSearchParams({ next: path })}`
    : SIGN_IN_PATH
}
