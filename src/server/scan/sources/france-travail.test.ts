import { expect, it } from "vitest"

import { buildProposal } from "@/domain/scan/proposal"
import { valueOf } from "@/domain/scan/field"
import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import { context, fixtureFile, testDefinitions } from "./adapter-test-fixtures"
import { franceTravailAdapter } from "./france-travail"

it("France Travail : recherche conservée pendant la pagination, identité stable et découverte séparée de l'employeur", async () => {
  const nextUrl = new URL(franceTravailSearchUrl)
  nextUrl.searchParams.set("range", "20-39")
  const ctx = context(testDefinitions["france-travail"], {
    [franceTravailSearchUrl]: fixtureFile("france-travail", "list.html"),
    [nextUrl.href]: fixtureFile("france-travail", "list.html"),
    "https://candidat.francetravail.fr/api-descriptifoffre/offre/215PYPJ":
      fixtureFile("france-travail", "posting-1.json"),
  })
  const first = await franceTravailAdapter.listPage(ctx, null)
  if (first.kind !== "listed") throw new Error(first.kind)
  expect(first.postings).toHaveLength(20)
  expect(first.postings[0].identityKey).toBe(
    "france-travail:candidat.francetravail.fr:215PYPJ",
  )
  await franceTravailAdapter.listPage(ctx, first.next)
  const read = await franceTravailAdapter.readPosting(ctx, first.postings[0])
  if (read.kind !== "extracted") throw new Error(read.kind)
  const proposal = buildProposal(read.posting, { referenceDate: "2026-10-24" })
  expect(valueOf(proposal.company)?.name).toBe(
    "SOCIETE DE GESTION DES ACTIVITES TOURIST",
  )
  expect(read.posting.officialUrl).toBeUndefined()
  expect(read.posting.sourceDate).toBeNull() // dateDerniereModification n'est pas une publication.
  expect(valueOf(proposal.period)).toMatchObject({
    duration: { value: 4, unit: "months" },
  })
  expect(valueOf(proposal.application)).toBeUndefined()
})
