import { expect, it, vi } from "vitest"

import { adapterCatalog } from "@/domain/scan/adapter-catalog"
import { buildProposal } from "@/domain/scan/proposal"
import { scanAdapterKinds } from "@/domain/scan/vocabulary"
import { scanAdapter } from "./adapters"
import { context, fixtureFile, testDefinitions } from "./adapter-test-fixtures"
import { listedPosting } from "./adapter"

const captures = ["belambra", "vvf", "ms-vacances", "france-travail"].flatMap(
  (source) => {
    const readme = fixtureFile(source, "README.md")
    return [
      ...readme.matchAll(/^\| (posting[^ |]+) \| (https:\/\/[^ |]+) \|/gm),
    ].map((match) => ({ source, file: match[1], url: match[2] }))
  },
)

it("les sources retenues sont couvertes et SmartRecruiters reste exclu", () => {
  expect(captures.length).toBeGreaterThanOrEqual(20)
  for (const source of Object.values(testDefinitions).filter(
    (source) => source.adapter !== "fixture",
  ))
    expect(scanAdapter(source.adapter)).not.toBeNull()
  expect(scanAdapter("smartrecruiters")).toBeNull()
})

it("le catalogue annonce la version d'extracteur de chaque adaptateur", () => {
  vi.stubEnv("SCAN_TEST_SOURCE_URL", "http://localhost:3200")
  for (const kind of scanAdapterKinds)
    expect(adapterCatalog[kind].version).toBe(
      kind === "fixture"
        ? "fixture@1"
        : (scanAdapter(kind)?.extractorVersion ?? null),
    )
  vi.unstubAllEnvs()
})

it.each(captures)(
  "$source / $file : champs établis prouvés et aucune balise HTML dans la sortie",
  async ({ source, file, url }) => {
    const definition = testDefinitions[source]
    const id =
      definition.adapter === "france-travail"
        ? /detail\/([A-Z0-9]+)/.exec(url)?.[1]
        : definition.adapter === "factorial"
          ? /-(\d+)$/.exec(url)?.[1]
          : /jobs\/(\d+)/.exec(url)?.[1]
    const readUrl =
      definition.adapter === "france-travail"
        ? `https://candidat.francetravail.fr/api-descriptifoffre/offre/${id}`
        : url
    const ctx = context(definition, { [readUrl]: fixtureFile(source, file) })
    const listed = listedPosting(ctx, url, {}, id)!
    const result = await scanAdapter(definition.adapter)!.readPosting(
      ctx,
      listed,
    )
    if (result.kind !== "extracted") {
      expect(file).toBe("posting-closed.html")
      return
    }
    const proposal = buildProposal(result.posting, {
      referenceDate: "2026-10-24",
    })
    function verify(value: unknown) {
      if (typeof value === "string")
        expect(value).not.toMatch(/<\/?[a-z][^>]*>/i)
      if (Array.isArray(value)) value.forEach(verify)
      else if (value && typeof value === "object") {
        const object = value as Record<string, unknown>
        if (object.status === "established")
          expect(object.evidence).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ scope: "posting" }),
            ]),
          )
        Object.values(object).forEach(verify)
      }
    }
    verify(result.posting)
    verify(proposal)
  },
)
