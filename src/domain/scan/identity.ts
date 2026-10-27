import type { ProposalField } from "./field"
import { periodBounds, type Period } from "./period"
import { normalizeJobTitle } from "./title"

export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (!/^https?:$/.test(url.protocol) || url.username || url.password)
      return null
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, "")
    // Une ancre simple (#postuler) ne désigne pas une autre page ; une route de navigateur
    // (#/offre/12, #!/offre/12) en désigne une.
    const route = /^#!?\//.test(url.hash) ? url.hash : ""
    url.hash = ""
    for (const key of [...url.searchParams.keys()])
      if (/^(?:utm_.*|gclid|dclid|fbclid|msclkid|mc_cid|mc_eid)$/i.test(key))
        url.searchParams.delete(key)
    url.searchParams.sort()
    url.pathname = url.pathname.replace(/\/+$/, "")
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}${url.search}${route}`
  } catch {
    return null
  }
}
export function recruitmentIdentity({
  adapter,
  host,
  externalId,
  url,
  index,
}: {
  adapter: string
  host: string
  externalId?: string | null
  url: string
  index?: number
}): string {
  const identity = externalId?.trim()
    ? `${adapter}:${host.toLowerCase().replace(/\.$/, "")}:${externalId.trim()}`
    : canonicalUrl(url)
  if (!identity) throw new RangeError("URL de recrutement invalide")
  if (index !== undefined && (!Number.isInteger(index) || index < 0))
    throw new RangeError("Index de poste invalide")
  return `${identity}${index !== undefined ? `#${index}` : ""}`
}
export type Recruitment = { title: string; period: ProposalField<Period> }
export function compareRecruitment(
  known: Recruitment,
  observed: Recruitment,
): "same" | "other_period" | "uncertain" {
  const a = known.period,
    b = observed.period
  const knownBounds = a.status === "established" ? periodBounds(a.value) : null
  const observedBounds =
    b.status === "established" ? periodBounds(b.value) : null
  if (
    knownBounds &&
    observedBounds &&
    (knownBounds.endDate < observedBounds.startDate ||
      observedBounds.endDate < knownBounds.startDate)
  )
    return "other_period"
  if (normalizeJobTitle(known.title) !== normalizeJobTitle(observed.title))
    return "uncertain"
  return "same"
}
