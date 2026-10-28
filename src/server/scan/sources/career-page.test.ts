import { expect, it } from "vitest"

import {
  deriveSourceConfig,
  type CareerPageParams,
} from "@/domain/scan/adapter-catalog"
import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import type { ScanSourceDefinition } from "@/domain/scan/source"

import {
  context,
  fixtureFile,
  success,
  testDefinitions,
} from "./adapter-test-fixtures"
import { careerPageAdapter } from "./career-page"
import { franceTravailAdapter } from "./france-travail"

const origin = "https://recrute.hotel-test.example"
function careerSource(
  overrides: Partial<CareerPageParams> = {},
  limits: ScanSourceDefinition["limits"] = {},
): ScanSourceDefinition {
  const params: CareerPageParams = {
    listUrl: `${origin}/offres`,
    postingPattern: `${origin}/offres/{slug}-{id}`,
    pagination: { kind: "next" },
    extraHosts: [],
    requireJsonLd: false,
    ...overrides,
  }
  return {
    ...testDefinitions.belambra,
    label: "Hôtel test",
    adapter: "career-page",
    adapterParams: params,
    ...deriveSourceConfig("career-page", params)!,
    limits,
  } as ScanSourceDefinition
}
const posting = (slug: string, id: number) => `${origin}/offres/${slug}-${id}`
const page = (links: string[], next?: string) =>
  `<html><body><a href="/contact">Contact</a><a href="https://ailleurs.example/offres/x-1">Ailleurs</a>${links.map((link) => `<a href="${link}">Fiche ${link}</a>`).join("")}${next ? `<a rel="next" href="${next}">Suivant</a>` : ""}</body></html>`

it("liste HTML : seules les fiches du motif et des hôtes officiels, pagination rel=next suivie", async () => {
  const ctx = context(careerSource(), {
    [`${origin}/offres`]: page(
      [
        posting("serveur", 1),
        posting("barman", 2),
        `${origin}/offres/sans-identifiant`,
      ],
      "/offres?page=2",
    ),
    [`${origin}/offres?page=2`]: page([posting("cuisinier", 3)]),
  })
  const first = await careerPageAdapter.listPage(ctx, null)
  if (first.kind !== "listed") throw new Error(first.kind)
  expect(first.postings.map((item) => item.url)).toEqual([
    posting("serveur", 1),
    posting("barman", 2),
  ])
  expect(first.postings[0].identityKey).toBe(
    "career-page:recrute.hotel-test.example:1",
  )
  expect(first.next).toEqual({ page: 1, url: `${origin}/offres?page=2` })
  const second = await careerPageAdapter.listPage(ctx, first.next)
  if (second.kind !== "listed") throw new Error(second.kind)
  expect(second.postings.map((item) => item.externalId)).toEqual(["3"])
  expect(second.next).toBeNull()
})

it("plan de site XML et flux RSS : les liens des fiches deviennent des pistes", async () => {
  const sitemap = careerSource({
    listUrl: `${origin}/sitemap.xml`,
    pagination: { kind: "none" },
  })
  const ctx = context(sitemap)
  ;(
    ctx.scanFetch as unknown as { mockImplementation: (fn: unknown) => void }
  ).mockImplementation(async (url: string) =>
    url.endsWith("sitemap.xml")
      ? success(
          `<?xml version="1.0"?><urlset><url><loc>${posting("serveur", 1)}</loc></url><url><loc>${origin}/mentions</loc></url></urlset>`,
          url,
          "application/xml",
        )
      : success(
          `<?xml version="1.0"?><rss><channel><item><title>Barman</title><link>${posting("barman", 2)}</link></item></channel></rss>`,
          url,
          "application/rss+xml",
        ),
  )
  const listed = await careerPageAdapter.listPage(ctx, null)
  if (listed.kind !== "listed") throw new Error(listed.kind)
  expect(listed.postings.map((item) => item.url)).toEqual([
    posting("serveur", 1),
  ])
  const rss = context(
    careerSource({
      listUrl: `${origin}/offres.rss`,
      pagination: { kind: "none" },
    }),
  )
  ;(
    rss.scanFetch as unknown as { mockImplementation: (fn: unknown) => void }
  ).mockImplementation(async (url: string) =>
    success(
      `<?xml version="1.0"?><rss><channel><item><title>Barman</title><link>${posting("barman", 2)}</link></item></channel></rss>`,
      url,
      "application/rss+xml",
    ),
  )
  const items = await careerPageAdapter.listPage(rss, null)
  if (items.kind !== "listed") throw new Error(items.kind)
  expect(items.postings).toEqual([
    expect.objectContaining({ url: posting("barman", 2), title: "Barman" }),
  ])
})

it("pagination par paramètre, bornée par la limite de pages de la source", async () => {
  const source = careerSource(
    { pagination: { kind: "param", name: "p" } },
    { maxListPages: 2 },
  )
  const ctx = context(source, {
    [`${origin}/offres`]: page([posting("serveur", 1)]),
    [`${origin}/offres?p=2`]: page([posting("barman", 2)]),
    [`${origin}/offres?p=3`]: page([posting("cuisinier", 3)]),
  })
  const first = await careerPageAdapter.listPage(ctx, null)
  if (first.kind !== "listed") throw new Error(first.kind)
  expect(first.next).toEqual({ page: 1 })
  const second = await careerPageAdapter.listPage(ctx, first.next)
  if (second.kind !== "listed") throw new Error(second.kind)
  expect(second.postings[0].externalId).toBe("2")
  expect(second.next).toBeNull()
})

it("robots.txt ou accès refusé : la source est bloquée, sans contournement", async () => {
  const ctx = context(careerSource())
  ;(
    ctx.scanFetch as unknown as { mockImplementation: (fn: unknown) => void }
  ).mockImplementation(async () => ({
    ok: false,
    reason: "robots_disallowed",
    robots: [],
    elapsedMs: 0,
    waitedMs: 0,
  }))
  expect(await careerPageAdapter.listPage(ctx, null)).toMatchObject({
    kind: "blocked",
    reason: "robots_disallowed",
  })
})

it("une fiche sans JSON-LD est lue, ou refusée si l'option l'exige", async () => {
  const body =
    "<html lang='fr'><body><h1>Serveur saisonnier</h1><p>CDD saisonnier à Chamonix, du 15 décembre 2026 au 15 avril 2027.</p></body></html>"
  const listed = {
    url: posting("serveur", 1),
    identityKey: "career-page:recrute.hotel-test.example:1",
    externalId: "1",
    data: {},
    listingHash: "h",
  }
  const lenient = await careerPageAdapter.readPosting(
    context(careerSource(), { [listed.url]: body }),
    listed,
  )
  expect(lenient.kind).toBe("extracted")
  const strict = await careerPageAdapter.readPosting(
    context(careerSource({ requireJsonLd: true }), { [listed.url]: body }),
    listed,
  )
  expect(strict).toEqual({ kind: "unreadable", reason: "invalid_document" })
})

it("France Travail : deux recherches lues l'une après l'autre, une offre commune garde son identité", async () => {
  const second = `${franceTravailSearchUrl.replace("lieux=99100", "lieux=74D")}`
  const ctx = context(
    {
      ...testDefinitions["france-travail"],
      listUrls: [franceTravailSearchUrl, second],
      // Une page par recherche : la suivante commence aussitôt.
      limits: { maxListPages: 1 },
    },
    {
      [franceTravailSearchUrl]: fixtureFile("france-travail", "list.html"),
      [second]: fixtureFile("france-travail", "list.html"),
    },
  )
  const pages: string[][] = []
  let cursor = null
  for (let step = 0; step < 4; step++) {
    const result = await franceTravailAdapter.listPage(ctx, cursor)
    if (result.kind !== "listed") throw new Error(result.kind)
    pages.push(result.postings.map((item) => item.identityKey))
    cursor = result.next
    if (!cursor) break
  }
  const calls = (
    ctx.scanFetch as unknown as { mock: { calls: [string][] } }
  ).mock.calls.map(([url]) => new URL(url).searchParams.get("lieux"))
  expect(calls).toContain("99100")
  expect(calls).toContain("74D")
  // La même offre vue par les deux recherches : une seule identité, dédoublonnée à la livraison.
  const all = pages.flat()
  expect(new Set(all).size).toBeLessThan(all.length)
})
