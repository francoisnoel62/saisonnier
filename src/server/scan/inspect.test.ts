import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

import { inspectScanDocument } from "./inspect"
import { testScanSourceDefinitions } from "@/test/scan-sources"

const sources = testScanSourceDefinitions()
function fixture(source: string, name: string) {
  return readFileSync(
    join(process.cwd(), "src/server/scan/sources/fixtures", source, name),
    "utf8",
  )
}

it("repère la pagination France Travail et ses vingt fiches, sans suivre les actions de compte", () => {
  const source = sources["france-travail"]
  const result = inspectScanDocument(
    {
      body: fixture("france-travail", "list.html"),
      finalUrl: source.listUrls[0],
      contentType: "text/html",
    },
    source,
  )
  expect(result.links).toHaveLength(20)
  expect(result.links[0]).toBe(
    "https://candidat.francetravail.fr/offres/recherche/detail/215PYPJ",
  )
  expect(result.pagination).toBe(true)
  expect(result.links.every((url) => !url.includes("t:ac="))).toBe(true)
})

it("compte le flux RSS réel et les liens uniques de fiche", () => {
  const result = inspectScanDocument(
    {
      body: fixture("belambra", "list.xml"),
      finalUrl: sources.belambra.listUrls[0],
      contentType: "application/rss+xml",
    },
    sources.belambra,
  )
  expect(result.rssItems).toBe(94)
  expect(result.links).toHaveLength(94)
  expect(result.pagination).toBe(false)
})
it("signale le JSON-LD JobPosting présent mais invalide de Teamtailor", () => {
  const result = inspectScanDocument(
    {
      body: fixture("belambra", "posting-9.html"),
      finalUrl: "https://recrute.belambra.fr/jobs/8557979-serveur-h-f",
      contentType: "text/html",
    },
    sources.belambra,
  )
  expect(result.jobPosting).toBe("invalid_json")
})
it("ne prend pas une candidature spontanée Factorial pour une fiche", () => {
  const result = inspectScanDocument(
    {
      body: fixture("vvf", "list.html"),
      finalUrl: sources.vvf.listUrls[0],
      contentType: "text/html",
    },
    sources.vvf,
  )
  expect(result.links).toHaveLength(27)
  expect(result.links.every((url) => url.includes("/job_posting/"))).toBe(true)
  expect(result.jobPosting).toBe("absent")
})
it("ne suit ni un hôte tiers ni un lien imitant le chemin de fiche", () => {
  const result = inspectScanDocument(
    {
      body: '<a href="https://other.example/jobs/123-poste">Autre</a><a href="/jobs/123-poste/apply">Formulaire</a><a href="/jobs/123-poste">Fiche</a><a href="/jobs/123-poste#apply">Doublon</a><a rel="next" href="/jobs/show_more?page=2">Suite</a>',
      finalUrl: sources.belambra.listUrls[0],
      contentType: "text/html",
    },
    sources.belambra,
  )
  expect(result.links).toEqual(["https://recrute.belambra.fr/jobs/123-poste"])
  expect(result.pagination).toBe(true)
})
it("détecte un JobPosting dans un graphe JSON-LD", () => {
  expect(
    inspectScanDocument(
      {
        body: '<script type="application/ld+json">{"@graph":[{"@type":["JobPosting"]}]}</script>',
        finalUrl: sources.belambra.listUrls[0],
        contentType: "text/html",
      },
      sources.belambra,
    ).jobPosting,
  ).toBe("valid")
})
