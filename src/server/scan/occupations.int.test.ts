import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, it } from "vitest"

import { insertScanCandidate } from "../../../e2e/helpers/scan"
import { established } from "@/domain/scan/field"
import { normalizeJobTitle } from "@/domain/scan/title"
import { db } from "@/lib/db"
import {
  occupationAliases,
  occupations,
  offers,
  scanCandidates,
  scanReviews,
} from "@/lib/db/schema"
import {
  createPublicationFixture,
  type PublicationFixture,
} from "@/test/scan-publication"

import { attachOccupation, decideOccupation } from "./occupations"
import { publishCandidate } from "./publication"

let fixture: PublicationFixture
const createdIds: string[] = []
beforeEach(async () => {
  fixture = await createPublicationFixture()
})
afterEach(async () => {
  await db
    .delete(occupationAliases)
    .where(eq(occupationAliases.createdByUserId, fixture.adminId))
  await fixture.cleanup()
  for (const id of createdIds.splice(0))
    await db.delete(occupations).where(eq(occupations.id, id))
})
async function unknown(title = `Métier du scan ${crypto.randomUUID()}`) {
  const proposal = {
    ...fixture.proposal,
    title: established(title, fixture.proposal.title.evidence),
  }
  const [candidate] = await db
    .update(scanCandidates)
    .set({ title, proposal })
    .where(eq(scanCandidates.id, fixture.candidate.id))
    .returning()
  return candidate
}
const attach = (id: string) =>
  attachOccupation(id, { runId: fixture.run.id, token: fixture.run.claimToken })

it("suggestion créée une fois, occurrence rejouée sans incrément, rejet jamais rouvert", async () => {
  const candidate = await unknown()
  await attach(candidate.id)
  await attach(candidate.id)
  let [review] = await db.select().from(scanReviews)
  expect(review.occurrences).toBe(1)
  expect(
    await decideOccupation(review.id, { kind: "reject" }, fixture.adminId),
  ).toEqual({ ok: true })
  const second = await insertScanCandidate(db.$client, {
    firstRunId: fixture.run.id,
    status: "to_review",
    title: candidate.title,
    proposal: candidate.proposal,
  })
  await attach(second.id)
  const reviews = await db.select().from(scanReviews)
  expect(reviews).toHaveLength(1)
  review = reviews[0]
  expect(review).toMatchObject({ status: "dismissed", occurrences: 2 })
})

it("rattacher : alias exact et propositions en attente mis à jour, aucune validation humaine créée sur une annonce automatique", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  const candidate = await unknown()
  await fixture.discovered()
  const published = await publishCandidate(fixture.scanRequest)
  if (!published.ok) throw new Error(published.reason)
  const [review] = await db.select().from(scanReviews)
  expect(review.kind).toBe("occupation")
  const [occupation] = await db
    .select()
    .from(occupations)
    .where(eq(occupations.isActive, true))
    .limit(1)
  expect(
    await decideOccupation(
      review.id,
      { kind: "attach", occupationId: occupation.id },
      fixture.adminId,
    ),
  ).toEqual({ ok: true })
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.id, published.offerId))
  expect(offer).toMatchObject({
    occupationId: occupation.id,
    status: "published",
    humanVerifiedAt: null,
    humanVerifiedByUserId: null,
  })
  const [alias] = await db
    .select()
    .from(occupationAliases)
    .where(
      eq(
        occupationAliases.normalizedLabel,
        normalizeJobTitle(candidate.title!),
      ),
    )
  expect(alias.occupationId).toBe(occupation.id)
  const second = await insertScanCandidate(db.$client, {
    firstRunId: fixture.run.id,
    status: "to_review",
    title: candidate.title,
    proposal: candidate.proposal,
  })
  await attach(second.id)
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, second.id))
    )[0].proposal?.occupationId,
  ).toBe(occupation.id)
  expect(await db.select().from(scanReviews)).toHaveLength(1)
})

it("créer le métier : schéma du référentiel, alias et dossier rattachés dans la même décision", async () => {
  const candidate = await unknown()
  await attach(candidate.id)
  const [review] = await db.select().from(scanReviews)
  const label = `Métier créé ${crypto.randomUUID().slice(0, 8)}`
  expect(
    await decideOccupation(
      review.id,
      { kind: "create", input: { label, family: "Famille de test" } },
      fixture.adminId,
    ),
  ).toEqual({ ok: true })
  const [occupation] = await db
    .select()
    .from(occupations)
    .where(eq(occupations.label, label))
  createdIds.push(occupation.id)
  expect(occupation).toMatchObject({
    isActive: true,
    family: "Famille de test",
  })
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, candidate.id))
    )[0],
  ).toMatchObject({ proposal: { occupationId: occupation.id }, version: 2 })
})

it("rattachement exact seulement : un métier actif préremplit, un intitulé approchant crée une revue", async () => {
  const [occupation] = await db
    .select()
    .from(occupations)
    .where(eq(occupations.isActive, true))
    .limit(1)
  await unknown(occupation.label)
  await attach(fixture.candidate.id)
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0].proposal?.occupationId,
  ).toBe(occupation.id)
  expect(await db.select().from(scanReviews)).toHaveLength(0)
  const candidate = await insertScanCandidate(db.$client, {
    firstRunId: fixture.run.id,
    status: "to_review",
    title: `${occupation.label} approchant`,
    proposal: fixture.proposal,
  })
  await attach(candidate.id)
  expect(await db.select().from(scanReviews)).toHaveLength(1)
})
