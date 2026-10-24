import { expect, it, vi } from "vitest"

import { buildProposal } from "@/domain/scan/proposal"
import { valueOf } from "@/domain/scan/field"
import { rssPostings } from "../extract/rss"
import { listedPosting } from "./adapter"
import {
  context,
  fixtureFile,
  success,
  testDefinitions,
} from "./adapter-test-fixtures"
import { teamtailorAdapter } from "./teamtailor"

it("Teamtailor : liste RSS identifiée, contrat explicite, salaire sans base en précision et avantages généraux hors du poste", async () => {
  const ctx = context(testDefinitions.belambra, {
    "https://recrute.belambra.fr/jobs.rss": fixtureFile("belambra", "list.xml"),
    "https://recrute.belambra.fr/jobs/8588693-second-de-cuisine-h-f":
      fixtureFile("belambra", "posting-1.html"),
  })
  const list = await teamtailorAdapter.listPage(ctx, null)
  expect(list.kind).toBe("listed")
  if (list.kind !== "listed") throw new Error(list.kind)
  expect(list.postings[0].identityKey).toBe(
    "teamtailor:recrute.belambra.fr:8588693",
  )
  const read = await teamtailorAdapter.readPosting(ctx, list.postings[0])
  if (read.kind !== "extracted") throw new Error(read.kind)
  const proposal = buildProposal(read.posting, { referenceDate: "2026-10-24" })
  expect(valueOf(proposal.contract)).toBe("seasonal")
  expect(valueOf(proposal.salary)).toBeUndefined()
  expect(valueOf(proposal.salaryPrecision)).toContain("base non précisée")
  expect(valueOf(proposal.conditions.housing)).toBeUndefined()
  expect(proposal.conditionPrecisions.housing).toBeUndefined()
  expect(valueOf(proposal.application)?.formUrl).toBe(list.postings[0].url)
  expect(
    read.posting.observations.some(
      (observation) =>
        observation.evidence.scope === "site" &&
        /logé/.test(String(observation.value)),
    ),
  ).toBe(true)
})

it("Teamtailor : JSON-LD comportant des contrôles bruts lu ; offre régionale à vérifier et plusieurs postes ambigus non séparés", async () => {
  const ctx = context()
  const listed = listedPosting(
    ctx,
    "https://recrute.belambra.fr/jobs/8340139-employes-saison-montagne-h-f",
    { title: "Employés saison montagne" },
    "8340139",
  )!
  vi.mocked(ctx.scanFetch).mockResolvedValue(
    success(fixtureFile("belambra", "posting-multiple.html"), listed.url),
  )
  const read = await teamtailorAdapter.readPosting(ctx, listed)
  if (read.kind !== "extracted") throw new Error(read.kind)
  const proposal = buildProposal(read.posting, { referenceDate: "2026-10-24" })
  expect(proposal.locations.status).toBe("to_verify")
  expect(read.posting.multiplePositions).toBe(true)
  expect(read.postings).toBeUndefined()
})

it("Teamtailor : flux absent, pagination HTML bornée", async () => {
  const source = { ...testDefinitions.belambra, limits: { maxListPages: 2 } }
  const ctx = context(source, {
    "https://recrute.belambra.fr/jobs":
      '<a href="/jobs/123-serveur">Serveur</a>',
    "https://recrute.belambra.fr/jobs/show_more?page=2":
      '<a href="/jobs/124-cuisinier">Cuisinier</a>',
  })
  const first = await teamtailorAdapter.listPage(ctx, null)
  if (first.kind !== "listed") throw new Error(first.kind)
  expect(first.next).toEqual({ page: 1, format: "html" })
  const second = await teamtailorAdapter.listPage(ctx, first.next)
  expect(second).toMatchObject({
    kind: "listed",
    next: null,
    postings: [{ externalId: "124" }],
  })
  expect(vi.mocked(ctx.scanFetch).mock.calls.map(([url]) => url)).toEqual([
    "https://recrute.belambra.fr/jobs.rss",
    "https://recrute.belambra.fr/jobs",
    "https://recrute.belambra.fr/jobs/show_more?page=2",
  ])
})

it.each([404, 410])("fiche disparue HTTP %s : gone", async (status) => {
  const ctx = context()
  vi.mocked(ctx.scanFetch).mockResolvedValue({
    ok: false,
    reason: status === 404 ? "not_found" : "gone",
    status,
    robots: [],
    elapsedMs: 0,
    waitedMs: 0,
  })
  const listed = rssPostings(fixtureFile("belambra", "list.xml"), ctx)![0]
  expect(await teamtailorAdapter.readPosting(ctx, listed)).toEqual({
    kind: "gone",
  })
})

it.each(["timeout", "http_error", "robots_disallowed"] as const)(
  "fiche %s : unreadable sans exception",
  async (reason) => {
    const ctx = context()
    vi.mocked(ctx.scanFetch).mockResolvedValue({
      ok: false,
      reason,
      robots: [],
      elapsedMs: 0,
      waitedMs: 0,
    })
    const listed = rssPostings(fixtureFile("belambra", "list.xml"), ctx)![0]
    expect(await teamtailorAdapter.readPosting(ctx, listed)).toEqual({
      kind: "unreadable",
      reason,
    })
  },
)
