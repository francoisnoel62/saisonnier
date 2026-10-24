import { eq } from "drizzle-orm"
import { beforeEach, afterEach, expect, it } from "vitest"
import { established } from "@/domain/scan/field"
import { db } from "@/lib/db"
import { offers, offerLocations, scanCandidates } from "@/lib/db/schema"
import {
  createPublicationFixture,
  type PublicationFixture,
} from "@/test/scan-publication"
import { publishCandidate } from "./publication"
import { upsertCollectedOffer } from "@/server/offers/ingest"
import { findDuplicateSuspects } from "./duplicates"

let fixture: PublicationFixture
beforeEach(async () => {
  fixture = await createPublicationFixture()
})
afterEach(async () => {
  await fixture.cleanup()
})

it("PR37: source officielle employeur renseignée sur un dossier France Travail", async () => {
  await db
    .update(scanCandidates)
    .set({ sourceKey: "france-travail" })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  const result = await publishCandidate(fixture.request)
  expect(result).toMatchObject({ ok: true })
})

it("PR37: corriger une annonce partageant légitimement sa source avec une autre saison", async () => {
  const published = await publishCandidate(fixture.request)
  if (!published.ok) throw new Error("Fixture publication failed")
  await db.insert(offers).values({
    ...fixture.input,
    status: "published",
    publishedAt: fixture.request.now,
    sourceCheckedAt: fixture.request.now,
    startDate: "2027-12-15",
    endDate: "2028-04-15",
  })
  const input = {
    ...fixture.input,
    sourceUrl: fixture.input.sourceUrl!,
    title: "Titre corrigé",
  }
  const result = await upsertCollectedOffer(
    input,
    { kind: "admin", userId: fixture.adminId },
    { offerId: published.offerId },
  )
  expect(result).toMatchObject({ ok: true })
})

it("PR37: rapprochement d'un recrutement sur le lieu supplémentaire d'une annonce", async () => {
  const [other] = await db
    .insert(offers)
    .values({
      ...fixture.input,
      origin: "deposited",
      sourceUrl: null,
      status: "published",
      publishedAt: fixture.request.now,
    })
    .returning()
  await db.insert(offerLocations).values({
    offerId: other.id,
    position: 1,
    communeName: "Lacanau",
    departmentCode: "33",
  })
  const proposal = {
    ...fixture.proposal,
    locations: established(
      [{ communeName: "Lacanau", departmentCode: "33", country: "France" }],
      fixture.proposal.locations.evidence,
    ),
  }
  const result = await findDuplicateSuspects(fixture.candidate, proposal)
  expect(result.suspects).toContainEqual({ kind: "offer", id: other.id })
})
