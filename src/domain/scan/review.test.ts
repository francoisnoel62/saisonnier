import { expect, it } from "vitest"

import { absent, established } from "./field"
import { buildProposal } from "./proposal"
import { proposalToAdminFormValues, proposalFormIssues } from "./proposal-form"
import {
  mergeQueueItems,
  snapshotRetryDelay,
  type ScanQueueItem,
} from "./queue"
import { observation, posting } from "./rules-fixtures"
import { publicationReadiness, canAutoPublish } from "./readiness"
import { readinessContext } from "./rules-fixtures"

it("préremplissage : seules les valeurs établies, sans case saisonnière pour un CDD seul ni saison inventée", () => {
  const proposal = buildProposal(
    posting({
      usefulText: "Nous recrutons un serveur en CDD dans notre restaurant.",
      title: "Serveur",
    }),
    { referenceDate: "2026-10-24" },
  )
  const values = proposalToAdminFormValues(
    { ...proposal, locations: absent(), season: absent() },
    { companyId: null },
  )
  expect(values).toMatchObject({
    origin: "collected",
    seasonalContract: false,
    season: "",
    companyId: "",
    communeName: "",
    departmentCode: "",
    housing: "unknown",
  })
})

it("préremplissage : troncature à la phrase et alerte, texte intégral conservé sur la proposition", () => {
  const proposal = buildProposal(posting(), { referenceDate: "2026-10-24" })
  const text = "Phrase intégrale. " + "Suite ".repeat(1100)
  proposal.description = established(text, [observation(text).evidence])
  const values = proposalToAdminFormValues(proposal, {
    companyId: "entreprise",
    sourceName: "Source officielle",
  })
  expect(values.description).toBe("Phrase intégrale.")
  expect(values.sourceName).toBe("Source officielle")
  expect(proposalFormIssues(proposal)).toMatchObject([
    { code: "text_truncated", field: "description", blocking: false },
  ])
  expect(proposal.description).toMatchObject({ value: text })
})

const item = (
  id: string,
  status: ScanQueueItem["status"] = "to_review",
): ScanQueueItem => ({
  id,
  status,
  title: id,
  companyName: null,
  location: null,
  sourceKey: "fixture",
  sourceLabel: "Source",
  readyForReviewAt: "2026-10-24T10:00:00Z",
  blockingCount: 0,
  alertCount: 0,
})
it("file : ordre conservé, nouveaux à la suite, dossier ouvert conservé même traité ailleurs", () => {
  const current = [item("a"), item("b"), item("c")]
  const result = mergeQueueItems(
    current,
    [item("d"), item("b")],
    [item("a", "published"), item("c", "rejected")],
    "c",
  )
  expect(result.map((value) => [value.id, value.status])).toEqual([
    ["b", "to_review"],
    ["c", "rejected"],
    ["d", "to_review"],
  ])
  expect(current.map((value) => value.status)).toEqual([
    "to_review",
    "to_review",
    "to_review",
  ])
})
it("échec de lecture : attente de 5, 10, 20, 40 puis 60 secondes", () => {
  expect([1, 2, 3, 4, 5, 6].map(snapshotRetryDelay)).toEqual([
    5000, 10000, 20000, 40000, 60000, 60000,
  ])
})

it("été/hiver absent est une alerte et ne bloque pas un contrat explicitement saisonnier", () => {
  const proposal = {
    ...buildProposal(posting(), { referenceDate: "2026-10-24" }),
    season: absent(),
  }
  const readiness = publicationReadiness(proposal, readinessContext)
  expect(readiness.blocking).toEqual([])
  expect(readiness.alerts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "season_unknown", blocking: false }),
    ]),
  )
  expect(
    canAutoPublish({ mode: "daily", sourceAutoPublish: true, readiness }),
  ).toBe(true)
})
