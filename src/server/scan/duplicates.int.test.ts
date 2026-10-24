import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, it } from "vitest"

import { insertScanCandidate } from "../../../e2e/helpers/scan"
import { admitPosting } from "@/domain/scan/admission"
import { admissionContext, observation } from "@/domain/scan/rules-fixtures"
import { db } from "@/lib/db"
import { offers, scanCandidates, scanReviews } from "@/lib/db/schema"
import {
  createPublicationFixture,
  type PublicationFixture,
} from "@/test/scan-publication"

import { decideDuplicate, findDuplicateSuspects } from "./duplicates"
import { recordDivergence } from "./divergences"
import { publishCandidate } from "./publication"
import { deliverCandidate } from "./candidates"
import { initRunSources } from "./run-sources"

let fixture: PublicationFixture
beforeEach(async () => {
  fixture = await createPublicationFixture()
})
afterEach(async () => {
  await fixture.cleanup()
})
async function otherOffer(
  origin: "collected" | "deposited" = "deposited",
  sameUrl = false,
) {
  const [offer] = await db
    .insert(offers)
    .values({
      ...fixture.input,
      companyId: fixture.company.id,
      origin,
      status: "published",
      publishedAt: new Date(),
      sourceUrl:
        origin === "collected"
          ? sameUrl
            ? fixture.input.sourceUrl
            : "https://recrute.belambra.fr/jobs/456-serveur"
          : null,
      sourceCheckedAt: origin === "collected" ? new Date() : null,
    })
    .returning()
  return offer
}
async function reviews() {
  return db.select().from(scanReviews)
}

it("doublon déposé : publication bloquée ; distinct : publication possible, décision non recréée", async () => {
  const other = await otherOffer()
  expect(
    await findDuplicateSuspects(fixture.candidate, fixture.proposal),
  ).toMatchObject({ suspects: [{ kind: "offer", id: other.id }] })
  const [review] = await reviews()
  expect(await publishCandidate(fixture.request)).toMatchObject({
    ok: false,
    issues: [expect.objectContaining({ code: "duplicate" })],
  })
  expect(await decideDuplicate(review.id, "distinct", fixture.adminId)).toEqual(
    { ok: true },
  )
  await findDuplicateSuspects(fixture.candidate, fixture.proposal)
  expect(await reviews()).toHaveLength(1)
  expect((await reviews())[0].status).toBe("resolved")
  expect(await publishCandidate(fixture.request)).toMatchObject({ ok: true })
  expect(
    (await db.select().from(offers).where(eq(offers.id, other.id)))[0],
  ).toEqual(other)
})

it("doublon confirmé : rejette seulement le dossier, ferme les revues et conserve le compteur", async () => {
  const other = await otherOffer()
  await findDuplicateSuspects(fixture.candidate, fixture.proposal)
  const [review] = await reviews()
  expect(
    await decideDuplicate(
      review.id,
      "duplicate",
      fixture.adminId,
      "Même recrutement",
    ),
  ).toEqual({ ok: true })
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0],
  ).toMatchObject({
    status: "rejected",
    rejectionReason: "duplicate",
    decidedByUserId: fixture.adminId,
  })
  expect((await reviews())[0]).toMatchObject({
    status: "resolved",
    decision: { kind: "duplicate", note: "Même recrutement" },
  })
  expect(
    (await db.select().from(offers).where(eq(offers.id, other.id)))[0],
  ).toEqual(other)
  expect(await publishCandidate(fixture.request)).toMatchObject({
    ok: false,
    reason: "conflict",
  })
})

it("même entreprise et métier mais périodes disjointes : aucune revue", async () => {
  const other = await otherOffer()
  await db
    .update(offers)
    .set({ startDate: "2027-12-15", endDate: "2028-04-15" })
    .where(eq(offers.id, other.id))
  expect(
    await findDuplicateSuspects(fixture.candidate, fixture.proposal),
  ).toMatchObject({ suspects: [] })
  expect(await reviews()).toEqual([])
})

it("même URL canonique, même identité saisie manuellement : already_known avant livraison, sans republication", async () => {
  const other = await otherOffer("collected", true)
  await db
    .update(offers)
    .set({ status: "unpublished" })
    .where(eq(offers.id, other.id))
  await fixture.discovered()
  expect(
    await findDuplicateSuspects(fixture.candidate, fixture.proposal),
  ).toMatchObject({ alreadyKnown: true, offerId: other.id })
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0],
  ).toMatchObject({
    status: "excluded",
    exclusionReason: "already_known",
    exclusionDetail: expect.stringContaining(other.id),
  })
  expect(
    (await db.select().from(offers).where(eq(offers.id, other.id)))[0].status,
  ).toBe("unpublished")
  expect(await reviews()).toEqual([])
})

it("deux dossiers livrés : une seule revue, quel que soit l'ordre de découverte", async () => {
  const other = await insertScanCandidate(db.$client, {
    firstRunId: fixture.run.id,
    sourceKey: "belambra",
    status: "to_review",
    title: fixture.candidate.title,
    proposal: fixture.proposal,
  })
  await findDuplicateSuspects(fixture.candidate, fixture.proposal)
  await findDuplicateSuspects(other, fixture.proposal)
  const [review] = await reviews()
  expect(await reviews()).toHaveLength(1)
  expect([review.candidateId, review.otherCandidateId].sort()).toEqual(
    [fixture.candidate.id, other.id].sort(),
  )
  expect(await decideDuplicate(review.id, "distinct", fixture.adminId)).toEqual(
    { ok: true },
  )
  await findDuplicateSuspects(other, fixture.proposal)
  expect(await reviews()).toHaveLength(1)
  expect(await publishCandidate(fixture.request)).toMatchObject({ ok: true })
  await findDuplicateSuspects(other, fixture.proposal)
  expect(await reviews()).toHaveLength(1)
})

it("redécouverte après publication : divergence signalée une fois et corrections admin préservées", async () => {
  const result = await publishCandidate(fixture.request)
  if (!result.ok) throw new Error(result.reason)
  await db
    .update(offers)
    .set({ title: "Titre corrigé par le fondateur", housing: "no" })
    .where(eq(offers.id, result.offerId))
  const [beforeOffer] = await db
    .select()
    .from(offers)
    .where(eq(offers.id, result.offerId))
  const [beforeCandidate] = await db
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, fixture.candidate.id))
  await initRunSources(fixture.run.id, ["belambra"], fixture.run.claimToken)
  const extraction = {
    ...fixture.extraction,
    observations: [
      ...fixture.extraction.observations,
      observation("Logement fourni."),
    ],
  }
  const admission = admitPosting(extraction, {
    ...admissionContext,
    source: { kind: "employer", officialHosts: ["recrute.belambra.fr"] },
  })
  if (!admission.admitted) throw new Error(admission.reason)
  const input = {
    candidateId: fixture.candidate.id,
    runId: fixture.run.id,
    token: fixture.run.claimToken,
    extraction,
    admission,
    proposal: admission.proposal,
    now: new Date(),
  }
  await deliverCandidate(input)
  await deliverCandidate(input)
  expect(
    (await reviews()).filter(
      (review) =>
        review.kind === "divergence" && review.details.field === "housing",
    ),
  ).toHaveLength(1)
  expect(
    (await db.select().from(offers).where(eq(offers.id, result.offerId)))[0],
  ).toEqual(beforeOffer)
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0],
  ).toEqual(beforeCandidate)
})

it("URL canonique identique mais autre poste : rapprochement sans écrasement", async () => {
  const other = await otherOffer("collected", true)
  await db
    .update(offers)
    .set({ title: "Cuisinier" })
    .where(eq(offers.id, other.id))
  expect(
    await findDuplicateSuspects(fixture.candidate, fixture.proposal),
  ).toMatchObject({
    alreadyKnown: false,
    suspects: [{ kind: "offer", id: other.id }],
  })
})

it("divergence : même valeur observée signalée une fois, même après décision", async () => {
  await recordDivergence(
    fixture.candidate,
    "housing",
    "yes",
    "no",
    "Logement fourni",
  )
  const [review] = await reviews()
  await db
    .update(scanReviews)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(eq(scanReviews.id, review.id))
  await recordDivergence(
    fixture.candidate,
    "housing",
    "yes",
    "no",
    "Logement fourni",
  )
  await recordDivergence(fixture.candidate, "housing", "no", "no")
  expect(await reviews()).toHaveLength(1)
  expect((await reviews())[0]).toMatchObject({
    status: "dismissed",
    details: { field: "housing", current: "no", observed: "yes" },
  })
})

it("une contradiction n'est pas une valeur établie à publier", async () => {
  await fixture.discovered()
  await db
    .update(scanCandidates)
    .set({
      proposal: {
        ...fixture.proposal,
        contract: {
          status: "contradictory",
          values: ["seasonal", "non_seasonal"],
          evidence: fixture.proposal.contract.evidence,
        },
      },
    })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "contract_contradiction" }),
    ]),
  })
})
