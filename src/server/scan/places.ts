import { z } from "zod"

import { established, type ProposalField } from "@/domain/scan/field"
import type { Evidence } from "@/domain/scan/observation"
import type { ProposedPlace } from "@/domain/scan/proposal"
import { fold } from "@/domain/scan/text"

import { evidence } from "./extract/evidence"
import { plainText } from "./extract/html"
import type { AdapterContext } from "./sources/adapter"

export type RawPlace = {
  name?: string
  communeName?: string
  postalCode?: string
  country?: string
  proof?: Evidence
}
export type PlaceResolution = ProposalField<ProposedPlace[]>
const communeSchema = z.object({
  nom: z.string().min(1),
  code: z.string(),
  codesPostaux: z.array(z.string()),
  codeDepartement: z.string(),
})
// Un contexte est réutilisé par passage ; aucune conservation inter-passages.
const caches = new WeakMap<
  AdapterContext,
  Map<string, Promise<PlaceResolution>>
>()
export function resolvePlace(
  raw: RawPlace,
  ctx: AdapterContext,
): Promise<PlaceResolution> {
  let cache = caches.get(ctx)
  if (!cache) {
    cache = new Map()
    caches.set(ctx, cache)
  }
  const key = JSON.stringify([
    fold(raw.name ?? ""),
    fold(raw.communeName ?? ""),
    raw.postalCode,
    fold(raw.country ?? ""),
  ])
  let result = cache.get(key)
  if (!result) {
    result = resolve(raw, ctx)
    cache.set(key, result)
  }
  return result.then((resolution) => ({
    ...structuredClone(resolution),
    evidence: [
      raw.proof ?? resolution.evidence[0],
      ...resolution.evidence.slice(1),
    ].filter((proof): proof is Evidence => !!proof),
  }))
}
async function resolve(
  raw: RawPlace,
  ctx: AdapterContext,
): Promise<PlaceResolution> {
  raw = {
    ...raw,
    name: raw.name ? plainText(raw.name) : undefined,
    communeName: raw.communeName ? plainText(raw.communeName) : undefined,
    country: raw.country ? plainText(raw.country) : undefined,
  }
  const proof =
    raw.proof ??
    evidence(
      "listing",
      ctx.source.listUrls[0],
      [raw.name, raw.communeName, raw.postalCode, raw.country]
        .filter(Boolean)
        .join(" · "),
    )
  const aliases = Object.entries(ctx.source.placeAliases)
  const alias = aliases.find(([name]) =>
    [raw.name, raw.communeName].some(
      (value) => value && fold(value.trim()) === fold(name.trim()),
    ),
  )?.[1]
  if (
    alias &&
    ctx.departmentCodes.includes(alias.departmentCode) &&
    alias.inseeCode.startsWith(alias.departmentCode)
  )
    return established(
      [
        {
          communeName: alias.name,
          inseeCode: alias.inseeCode,
          departmentCode: alias.departmentCode,
          country: "France",
          ...(raw.postalCode ? { postalCode: raw.postalCode } : {}),
        },
      ],
      [proof],
    )
  const unresolved: PlaceResolution = {
    status: "to_verify",
    value: [
      {
        communeName: raw.communeName ?? raw.name,
        postalCode: raw.postalCode,
        country: raw.country,
      },
    ],
    evidence: [proof],
  }
  if (
    !raw.communeName ||
    !raw.postalCode ||
    !/^\d{5}$/.test(raw.postalCode) ||
    (raw.country && !["fr", "france", "fra"].includes(fold(raw.country)))
  )
    return unresolved
  const url = new URL("https://geo.api.gouv.fr/communes")
  url.searchParams.set("codePostal", raw.postalCode)
  url.searchParams.set("nom", raw.communeName)
  url.searchParams.set("fields", "nom,code,codesPostaux,codeDepartement")
  try {
    // Les 5 s bornent l'échange lui-même ; l'attente de politesse suit l'échéance de l'étape.
    const response = await ctx.scanFetch(url.href, {
      deadline: ctx.deadline,
      exchangeTimeoutMs: 5000,
    })
    if (!response.ok) return unresolved
    const parsed = z.array(communeSchema).safeParse(JSON.parse(response.body))
    if (!parsed.success) return unresolved
    const candidates = parsed.data
      .filter((place) => place.codesPostaux.includes(raw.postalCode!))
      .map((place) => ({
        communeName: plainText(place.nom),
        inseeCode: place.code,
        postalCode: raw.postalCode,
        departmentCode: place.codeDepartement,
        country: "France",
      }))
    if (
      candidates.length !== 1 ||
      !candidates[0].communeName ||
      !ctx.departmentCodes.includes(candidates[0].departmentCode) ||
      !candidates[0].inseeCode.startsWith(candidates[0].departmentCode)
    )
      return {
        ...unresolved,
        value: candidates.length ? candidates : unresolved.value,
      }
    return established(candidates, [
      proof,
      evidence("api", url.href, plainText(response.body)),
    ])
  } catch {
    return unresolved
  }
}
