import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, it } from "vitest"

import { insertScanCandidate } from "../../../e2e/helpers/scan"

import { absent } from "@/domain/scan/field"
import { db } from "@/lib/db"
import {
  blockedDomains,
  offers,
  scanCandidates,
  scanReviews,
  scanRuns,
  scanSources,
} from "@/lib/db/schema"
import {
  createPublicationFixture,
  publicationNow,
  type PublicationFixture,
} from "@/test/scan-publication"

import { publishCandidate } from "./publication"

let fixture: PublicationFixture
beforeEach(async () => {
  fixture = await createPublicationFixture()
})
afterEach(async () => {
  await fixture.cleanup()
})
async function stored() {
  return (
    await db
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, fixture.candidate.id))
  )[0]
}

it("deux validations simultanées et leur rejeu donnent une seule annonce vérifiée par un humain", async () => {
  const results = await Promise.all([
    publishCandidate(fixture.request),
    publishCandidate(fixture.request),
  ])
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ ok: true, created: true }),
      expect.objectContaining({ ok: true, created: false }),
    ]),
  )
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.companyId, fixture.company.id))
  expect(
    results.every((result) => result.ok && result.offerId === offer.id),
  ).toBe(true)
  expect(offer).toMatchObject({
    status: "published",
    humanVerifiedAt: publicationNow,
    humanVerifiedByUserId: fixture.adminId,
    sourceCheckedAt: publicationNow,
    sourcePublishedDate: "2026-10-23",
    sourcePublishedAt: new Date("2026-10-23T08:00:00Z"),
    firstDiscoveredAt: publicationNow,
  })
  expect(await stored()).toMatchObject({
    publicationKind: "human",
    version: fixture.candidate.version + 1,
  })
  expect(await publishCandidate(fixture.request)).toEqual({
    ok: true,
    created: false,
    offerId: offer.id,
  })
})

it("version périmée : refuse sans modifier le dossier", async () => {
  expect(
    await publishCandidate({ ...fixture.request, version: 99 }),
  ).toMatchObject({ ok: false, reason: "conflict" })
  expect(await stored()).toEqual(fixture.candidate)
})

it("un formulaire humain complet résout les manques de la proposition originale", async () => {
  await db
    .update(scanCandidates)
    .set({
      proposal: {
        ...fixture.proposal,
        contract: absent(),
        period: absent(),
        season: absent(),
        activity: absent(),
      },
    })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  expect(await publishCandidate(fixture.request)).toMatchObject({
    ok: true,
    created: true,
  })
})

it("le remplissage initial ne publie jamais automatiquement", async () => {
  await fixture.discovered()
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    reason: "blocked",
    issues: [
      expect.objectContaining({ label: expect.stringContaining("initial") }),
    ],
  })
})

it("quotidien autorisé : publie sans validation humaine, sans inventer de conditions", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  const result = await publishCandidate(fixture.scanRequest)
  expect(result).toMatchObject({ ok: true, created: true })
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.companyId, fixture.company.id))
  expect(offer).toMatchObject({
    humanVerifiedAt: null,
    humanVerifiedByUserId: null,
    housing: "unknown",
    salaryNetMinCents: null,
    salaryGrossMinCents: null,
  })
  expect(await stored()).toMatchObject({ publicationKind: "automatic" })
})

it("quotidien : source non autorisée ou jeton remplacé, aucune publication", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  await db
    .update(scanSources)
    .set({ autoPublish: false })
    .where(eq(scanSources.key, "belambra"))
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    reason: "blocked",
  })
  await db
    .update(scanRuns)
    .set({ claimToken: crypto.randomUUID() })
    .where(eq(scanRuns.id, fixture.run.id))
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    reason: "conflict",
  })
})

it("source hors des hôtes officiels et échéance passée : refus motivé", async () => {
  const result = await publishCandidate({
    ...fixture.request,
    input: {
      ...fixture.input,
      sourceUrl: "https://intrus.example/job",
      applicationDeadline: "2026-10-23",
    },
  })
  expect(result).toMatchObject({
    ok: false,
    reason: "blocked",
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "official_source" }),
      expect.objectContaining({ code: "activity" }),
    ]),
  })
})

it("relit les domaines exclus dans la transaction", async () => {
  await db
    .insert(blockedDomains)
    .values({ domain: "hotel.example" })
    .onConflictDoNothing()
  try {
    expect(await publishCandidate(fixture.request)).toMatchObject({
      ok: false,
      reason: "blocked",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "blocked_domain" }),
      ]),
    })
  } finally {
    await db
      .delete(blockedDomains)
      .where(eq(blockedDomains.domain, "hotel.example"))
  }
})

it.each(["unpublished", "expired", "rejected"] as const)(
  "rejeu après retrait %s : annonce et dossier préservés",
  async (status) => {
    const published = await publishCandidate(fixture.request)
    if (!published.ok) throw new Error(published.reason)
    await db
      .update(offers)
      .set({ status })
      .where(eq(offers.id, published.offerId))
    const [before] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, published.offerId))
    expect(await publishCandidate(fixture.request)).toEqual({
      ok: true,
      created: false,
      offerId: published.offerId,
    })
    expect(
      (
        await db.select().from(offers).where(eq(offers.id, published.offerId))
      )[0],
    ).toEqual(before)
  },
)

it("un doublon ouvert bloque aussi le second dossier du rapprochement", async () => {
  const other = await insertScanCandidate(db.$client, {
    firstRunId: fixture.run.id,
    status: "to_review",
  })
  await db
    .insert(scanReviews)
    .values({
      kind: "duplicate",
      groupKey: "other-side",
      candidateId: other.id,
      otherCandidateId: fixture.candidate.id,
    })
  expect(await publishCandidate(fixture.request)).toMatchObject({
    ok: false,
    reason: "blocked",
    issues: [expect.objectContaining({ code: "duplicate" })],
  })
})
