import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

import { inspectScanDocument } from "./inspect"
import { buildScanSourceDefinitions } from "./sources/registry"

const sources = buildScanSourceDefinitions()
function fixture(source: string, name: string) {
  return readFileSync(
    join(process.cwd(), "src/server/scan/sources/fixtures", source, name),
    "utf8",
  )
}

it("compte le flux RSS réel et les liens uniques de fiche", () => {
  const result = inspectScanDocument(
    fixture("belambra", "list.xml"),
    sources.belambra.listUrls[0],
    "application/rss+xml",
    sources.belambra,
  )
  expect(result.rssItems).toBe(94)
  expect(result.links).toHaveLength(94)
  expect(result.pagination).toBe(false)
})
it("signale le JSON-LD JobPosting présent mais invalide de Teamtailor", () => {
  const result = inspectScanDocument(
    fixture("belambra", "posting-9.html"),
    "https://recrute.belambra.fr/jobs/8557979-serveur-h-f",
    "text/html",
    sources.belambra,
  )
  expect(result.jobPosting).toBe("invalid_json")
})
it("ne prend pas une candidature spontanée Factorial pour une fiche", () => {
  const result = inspectScanDocument(
    fixture("vvf", "list.html"),
    sources.vvf.listUrls[0],
    "text/html",
    sources.vvf,
  )
  expect(result.links).toHaveLength(27)
  expect(result.links.every((url) => url.includes("/job_posting/"))).toBe(true)
  expect(result.jobPosting).toBe("absent")
})
it("ne suit ni un hôte tiers ni un lien imitant le chemin de fiche", () => {
  const body =
    '<a href="https://other.example/jobs/123-poste">Autre</a><a href="/jobs/123-poste/apply">Formulaire</a><a href="/jobs/123-poste">Fiche</a><a href="/jobs/123-poste#apply">Doublon</a><a rel="next" href="/jobs/show_more?page=2">Suite</a>'
  const result = inspectScanDocument(
    body,
    sources.belambra.listUrls[0],
    "text/html",
    sources.belambra,
  )
  expect(result.links).toEqual(["https://recrute.belambra.fr/jobs/123-poste"])
  expect(result.pagination).toBe(true)
})
it("détecte un JobPosting dans un graphe JSON-LD et une liste API paginée", () => {
  expect(
    inspectScanDocument(
      '<script type="application/ld+json">{"@graph":[{"@type":["JobPosting"]}]}</script>',
      sources.belambra.listUrls[0],
      "text/html",
      sources.belambra,
    ).jobPosting,
  ).toBe("valid")
  const result = inspectScanDocument(
    JSON.stringify({
      content: [
        {
          ref: "https://api.smartrecruiters.com/v1/companies/Accor/postings/123",
        },
      ],
      totalFound: 2,
    }),
    sources.accor.listUrls[0],
    "application/json",
    sources.accor,
  )
  expect(result.links).toHaveLength(1)
  expect(result.pagination).toBe(true)
})
