import { isLocalTestOrigin } from "./url-safety"

// D8 : l'admin ne saisit jamais d'expression régulière. Un motif simplifié
// (https://site.fr/offres/{slug}-{id}) est compilé par le code en expression ancrée, aux
// classes de caractères simples, sans quantificateur imbriqué (§9).
//   {id}   identifiant numérique, capturé comme identifiant externe
//   {code} identifiant alphanumérique, capturé
//   {slug} partie de segment ; {*} segment quelconque
//   ?nom={id} paramètre de requête ; une route de navigateur (#/…) reste littérale
export const urlPatternLimits = { length: 300, tokens: 8 } as const
type Token = "id" | "code" | "slug" | "*"
const tokenRegExp: Record<Token, string> = {
  id: "([0-9]+)",
  code: "([A-Za-z0-9]+)",
  slug: "[^/?#]+",
  "*": "[^/?#]+",
}
type Part = { literal: string } | { token: Token }
export type ParsedUrlPattern = {
  origin: string
  host: string
  path: Part[]
  query: { name: string; value: Part }[]
  route: string
  capture: "id" | "code" | null
}
export type UrlPatternResult =
  { ok: true; pattern: ParsedUrlPattern } | { ok: false; message: string }

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function split(text: string): Part[] | string {
  const parts: Part[] = []
  let rest = text
  while (rest) {
    const start = rest.indexOf("{")
    if (start < 0) {
      parts.push({ literal: rest })
      break
    }
    if (start > 0) parts.push({ literal: rest.slice(0, start) })
    const end = rest.indexOf("}", start)
    if (end < 0) return "Accolade non fermée."
    const name = rest.slice(start + 1, end)
    if (!["id", "code", "slug", "*"].includes(name))
      return `Jeton inconnu : {${name}} (seuls {id}, {code}, {slug} et {*} existent).`
    parts.push({ token: name as Token })
    rest = rest.slice(end + 1)
  }
  if (parts.some((part) => "literal" in part && /[{}]/.test(part.literal)))
    return "Accolade isolée."
  return parts
}

export function parseUrlPattern(value: string): UrlPatternResult {
  const input = value.trim()
  const fail = (message: string) => ({ ok: false as const, message })
  if (!input) return fail("Motif attendu.")
  if (input.length > urlPatternLimits.length)
    return fail(`${urlPatternLimits.length} caractères au plus.`)
  if (/\s/.test(input)) return fail("Le motif ne contient pas d'espace.")
  const match =
    /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/.exec(
      input,
    )
  if (!match)
    return fail(
      "Commencez par https:// et un hôte exact, en minuscules, sans port ni joker.",
    )
  const [, origin, rawPath = "/", rawQuery = "", rawRoute = ""] = match
  if (origin.startsWith("http://") && !isLocalTestOrigin(origin))
    return fail("Adresse https attendue.")
  const host = new URL(origin).hostname
  if (/\{|\}/.test(host) || host.startsWith(".") || host.endsWith("."))
    return fail("Hôte exact attendu, sans joker.")
  if (rawRoute && (/[{}]/.test(rawRoute) || !/^#!?\//.test(rawRoute)))
    return fail("Une route de navigateur (#/…) reste littérale.")
  const path = split(rawPath.replace(/\/$/, "") || "/")
  if (typeof path === "string") return fail(path)
  const query: ParsedUrlPattern["query"] = []
  for (const pair of rawQuery.slice(1).split("&").filter(Boolean)) {
    const [name, item = ""] = pair.split("=")
    if (!/^[A-Za-z0-9_.-]+$/.test(name ?? ""))
      return fail(`Paramètre invalide : ${pair}.`)
    const parts = split(item)
    if (typeof parts === "string") return fail(parts)
    if (
      parts.length > 1 ||
      (parts[0] &&
        "token" in parts[0] &&
        parts[0].token !== "id" &&
        parts[0].token !== "code")
    )
      return fail(
        "Un paramètre vaut un texte littéral, {id} ou {code}, sans mélange.",
      )
    query.push({ name, value: parts[0] ?? { literal: "" } })
  }
  const tokens = [...path, ...query.map((item) => item.value)].filter(
    (part): part is { token: Token } => "token" in part,
  )
  if (tokens.length > urlPatternLimits.tokens)
    return fail(`${urlPatternLimits.tokens} jetons au plus.`)
  const captures = tokens.filter(
    (part) => part.token === "id" || part.token === "code",
  )
  if (captures.length > 1)
    return fail("Une seule capture ({id} ou {code}) par motif.")
  for (let index = 1; index < path.length; index++)
    if ("token" in path[index] && "token" in path[index - 1])
      return fail(
        "Deux jetons ne se suivent jamais : séparez-les par un texte.",
      )
  // Une seule partie de longueur libre ({slug} ou {*}) par segment : pas de retour arrière
  // combinatoire sur une URL hostile.
  const segments: Part[][] = [[]]
  for (const part of path) {
    if ("literal" in part) {
      const pieces = part.literal.split("/")
      pieces.forEach((piece, index) => {
        if (index > 0) segments.push([])
        if (piece) segments.at(-1)!.push({ literal: piece })
      })
    } else segments.at(-1)!.push(part)
  }
  if (
    segments.some(
      (segment) =>
        segment.filter(
          (part) =>
            "token" in part && (part.token === "slug" || part.token === "*"),
        ).length > 1,
    )
  )
    return fail("Un seul {slug} ou {*} par segment de chemin.")
  return {
    ok: true,
    pattern: {
      origin,
      host,
      path,
      query: query.sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      ),
      route: rawRoute,
      capture: captures[0] ? (captures[0].token as "id" | "code") : null,
    },
  }
}

function partSource(part: Part) {
  return "literal" in part
    ? escapeRegExp(part.literal)
    : tokenRegExp[part.token]
}
// Expression ancrée, comparée à l'URL canonique (canonicalUrl trie les paramètres). Barre
// finale facultative sans requête.
export function compileUrlPattern(value: string): string | null {
  const parsed = parseUrlPattern(value)
  if (!parsed.ok) return null
  const { origin, path, query, route } = parsed.pattern
  const pathSource = path.map(partSource).join("")
  const querySource = query.length
    ? `\\?${query.map((item) => `${escapeRegExp(item.name)}=${partSource(item.value)}`).join("&")}`
    : ""
  const routeSource = route ? escapeRegExp(route) : ""
  const slash = querySource || routeSource || pathSource === "/" ? "" : "/?"
  return `^${escapeRegExp(origin)}${pathSource === "/" ? "/?" : pathSource}${slash}${querySource}${routeSource}$`
}

// Identifiant externe capturé par le motif, s'il y en a un.
export function capturedId(pattern: string, url: string) {
  return new RegExp(pattern).exec(url)?.[1]
}

// Motif proposé depuis des liens observés (§9) : regroupement par hôte, nombre de segments et
// clés de requête ; le plus grand groupe (trois liens au moins) décide.
export type UrlPatternSuggestion = {
  pattern: string
  matched: number
  examples: string[]
}
function segmentToken(values: string[]) {
  if (values.every((value) => value === values[0])) return values[0]
  if (values.every((value) => /^[0-9]+$/.test(value))) return "{id}"
  if (values.every((value) => /^[0-9]+-[^/]+$/.test(value)))
    return "{id}-{slug}"
  if (values.every((value) => /^.+-[0-9]+$/.test(value))) return "{slug}-{id}"
  if (
    values.every(
      (value) => /^[A-Za-z0-9]{4,20}$/.test(value) && /[0-9]/.test(value),
    )
  )
    return "{code}"
  return "{slug}"
}
export function suggestUrlPattern(
  links: readonly string[],
): UrlPatternSuggestion | null {
  const groups = new Map<string, URL[]>()
  for (const link of links) {
    try {
      const url = new URL(link)
      if (url.protocol !== "https:" && !isLocalTestOrigin(url.origin)) continue
      const segments = url.pathname.split("/").filter(Boolean)
      if (!segments.length) continue
      const key = `${url.origin}|${segments.length}|${[...url.searchParams.keys()].sort().join(",")}`
      groups.set(key, [...(groups.get(key) ?? []), url])
    } catch {
      /* Lien inexploitable. */
    }
  }
  const [urls] = [...groups.values()].sort((a, b) => b.length - a.length)
  if (!urls || urls.length < 3) return null
  const unique = [...new Map(urls.map((url) => [url.href, url])).values()]
  if (unique.length < 3) return null
  const segmentCount = unique[0].pathname.split("/").filter(Boolean).length
  const tokens = Array.from({ length: segmentCount }, (_, index) =>
    segmentToken(
      unique.map((url) => url.pathname.split("/").filter(Boolean)[index]),
    ),
  )
  // Une seule capture : les captures précédant la dernière deviennent des parties libres.
  let captureSeen = false
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (/\{id\}|\{code\}/.test(tokens[index])) {
      if (captureSeen)
        tokens[index] = tokens[index].includes("-") ? "{slug}" : "{*}"
      captureSeen = true
    }
  }
  const query = [...unique[0].searchParams.keys()].sort().map((name) => {
    const values = unique.map((url) => url.searchParams.get(name) ?? "")
    const value =
      !captureSeen && values.every((item) => /^[0-9]+$/.test(item))
        ? "{id}"
        : values.every((item) => item === values[0])
          ? values[0]
          : null
    if (value === "{id}") captureSeen = true
    return value === null ? null : `${name}=${value}`
  })
  if (query.includes(null)) return null
  const pattern = `${unique[0].origin}/${tokens.join("/")}${query.length ? `?${query.join("&")}` : ""}`
  const compiled = compileUrlPattern(pattern)
  if (!compiled) return null
  const expression = new RegExp(compiled)
  const matching = unique.filter((url) =>
    expression.test(url.href.replace(/\/$/, "")),
  )
  return matching.length >= 3
    ? {
        pattern,
        matched: matching.length,
        examples: matching.slice(0, 3).map((url) => url.href),
      }
    : null
}
