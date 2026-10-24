import { expect, it } from "vitest"

import { buildProposal } from "@/domain/scan/proposal"
import { valueOf } from "@/domain/scan/field"
import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import { context, fixtureFile, testDefinitions } from "./adapter-test-fixtures"
import { franceTravailAdapter } from "./france-travail"
import { success } from "./adapter-test-fixtures"
import { vi } from "vitest"

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
  expect(valueOf(proposal.contract)).toBe("seasonal")
  expect(valueOf(proposal.application)).toBeUndefined()
})

it("France Travail 215QHWT : Huez (38) est un lieu établi sans code postal ni code INSEE", async () => {
  const url =
    "https://candidat.francetravail.fr/offres/recherche/detail/215QHWT"
  const ctx = context(testDefinitions["france-travail"])
  vi.mocked(ctx.scanFetch).mockResolvedValue(
    success(
      JSON.stringify({
        intituleOffre: "Chef de rang (H/F)",
        descriptif:
          "Nous recherchons un chef de rang pour notre restaurant. Ce poste saisonnier est à pourvoir cet hiver.",
        lieuTravail: {
          libelleLieuTravail: "Huez",
          libelleCommuneLieuTravail: "Huez",
          codeDepartementLieuTravail: "38",
          syntheseLieuTravail: "38 - Huez",
        },
        etablissement: { libelleEnseigne: "LA FOLIE DOUCE SAINT GERVAIS" },
      }),
      url,
      "application/json",
    ),
  )
  const result = await franceTravailAdapter.readPosting(ctx, {
    url,
    identityKey: "france-travail:candidat.francetravail.fr:215QHWT",
    externalId: "215QHWT",
    listingHash: "huez",
    data: {},
  })
  if (result.kind !== "extracted") throw new Error(result.kind)
  const proposal = buildProposal(result.posting, {
    referenceDate: "2026-10-24",
  })
  expect(valueOf(proposal.locations)).toEqual([
    { communeName: "Huez", departmentCode: "38", country: "France" },
  ])
  expect(valueOf(proposal.company)).toEqual({
    name: "LA FOLIE DOUCE SAINT GERVAIS",
  })
})
