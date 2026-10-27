import { expect, it, vi } from "vitest"

import { buildProposal } from "@/domain/scan/proposal"
import { valueOf } from "@/domain/scan/field"
import {
  context,
  fixtureFile,
  success,
  testDefinitions,
} from "./adapter-test-fixtures"
import { factorialAdapter } from "./factorial"

it("Factorial : candidature spontanée ignorée et identifiants uniques malgré les slugs répétés", async () => {
  const ctx = context(testDefinitions.vvf, {
    "https://vvfrecrute.factorial.fr/": fixtureFile("vvf", "list.html"),
  })
  const list = await factorialAdapter.listPage(ctx, null)
  if (list.kind !== "listed") throw new Error(list.kind)
  expect(list.postings).toHaveLength(27)
  expect(
    new Set(list.postings.map((posting) => posting.identityKey)).size,
  ).toBe(27)
  expect(
    list.postings.every((posting) => !posting.url.includes("/apply")),
  ).toBe(true)
  expect(
    list.postings.some(
      (posting) => posting.data.place === "PRAPOUTEL LES SEPT LAUX",
    ),
  ).toBe(true)
})

it("Factorial : dates libres, formulaire seul, alias vérifié et logement possible non établi", async () => {
  const ctx = context(testDefinitions.vvf, {
    "https://vvfrecrute.factorial.fr/": fixtureFile("vvf", "list.html"),
  })
  const list = await factorialAdapter.listPage(ctx, null)
  if (list.kind !== "listed") throw new Error(list.kind)
  const listed = list.postings.find(
    (posting) => posting.externalId === "326962",
  )!
  vi.mocked(ctx.scanFetch).mockResolvedValue(
    success(fixtureFile("vvf", "posting-8.html"), listed.url),
  )
  const read = await factorialAdapter.readPosting(ctx, listed)
  if (read.kind !== "extracted") throw new Error(read.kind)
  const proposal = buildProposal(read.posting, { referenceDate: "2026-10-24" })
  expect(valueOf(proposal.contract)).toBe("seasonal")
  expect(proposal.period).toMatchObject({
    status: "established",
    value: { startDate: "2027-02-01", endDate: "2027-03-23" },
  })
  expect(valueOf(proposal.application)).toMatchObject({
    emails: [],
    phones: [],
    formUrl: "https://vvfrecrute.factorial.fr/apply/serveur-h-f-326962",
  })
  expect(valueOf(proposal.locations)).toMatchObject([
    { communeName: "Les Adrets", departmentCode: "38", inseeCode: "38002" },
  ])
  expect(valueOf(proposal.conditions.housing)).toBeUndefined()
  expect(proposal.conditionPrecisions.housing).toContain("possible")
  expect(valueOf(proposal.salary)).toBeUndefined()
})

it("Factorial : HTTP 200 fermé ne prouve jamais l'activité", async () => {
  const ctx = context(testDefinitions.vvf)
  vi.mocked(ctx.scanFetch).mockResolvedValue(
    success(
      fixtureFile("vvf", "posting-closed.html"),
      "https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-318954",
    ),
  )
  const read = await factorialAdapter.readPosting(ctx, {
    url: "https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-318954",
    identityKey: "closed",
    listingHash: "closed",
    data: {},
    title: "Serveur",
  })
  if (read.kind === "extracted")
    expect(
      valueOf(
        buildProposal(read.posting, { referenceDate: "2026-10-24" }).activity,
      ),
    ).not.toBe("active")
  else expect(read.kind).toBe("unreadable")
})
