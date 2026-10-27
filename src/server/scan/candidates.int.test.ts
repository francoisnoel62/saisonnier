import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  insertScanCandidate,
  insertScanRun,
  insertScanSource,
  resetScan,
} from "../../../e2e/helpers/scan"
import { admitPosting } from "@/domain/scan/admission"
import { established } from "@/domain/scan/field"
import {
  observation,
  posting,
  admissionContext,
  evidence,
} from "@/domain/scan/rules-fixtures"
import { db } from "@/lib/db"
import {
  companies,
  offers,
  scanCandidates,
  scanReviews,
  scanRuns,
  scanRunSources,
  type ScanRun,
} from "@/lib/db/schema"

import {
  deliverCandidate,
  excludeCandidate,
  newGeneration,
  nextPistesToProcess,
  recordFailure,
  recordListedPosting,
  type CandidateDelivery,
} from "./candidates"
import { getRunReport, getRunState } from "./queries"
import { initRunSources } from "./run-sources"
import { renewClaim } from "./runs"

const now = new Date("2026-10-24T10:00:00Z")
let run: ScanRun
beforeEach(async () => {
  await resetScan(db.$client)
  run = await insertScanRun(db.$client, { startedAt: now })
  await initRunSources(run.id, ["fixture"], run.claimToken)
})
afterAll(() => resetScan(db.$client))

async function candidate(
  values: Partial<typeof scanCandidates.$inferInsert> = {},
) {
  return insertScanCandidate(db.$client, {
    firstRunId: run.id,
    firstSeenAt: now,
    lastSeenAt: now,
    ...values,
  })
}
function input(
  candidateId: string,
  changes: Partial<CandidateDelivery> = {},
): CandidateDelivery {
  const extraction = posting()
  const admission = admitPosting(extraction, admissionContext)
  if (!admission.admitted) throw new Error("Fixture non admise")
  return {
    candidateId,
    runId: run.id,
    token: run.claimToken,
    extraction,
    admission,
    proposal: admission.proposal,
    now,
    ...changes,
  }
}
async function currentRun() {
  return (await getRunState(run.id))!.run
}

it("livraison rejouée : compteur inchangé, décision et contenu préservés", async () => {
  const c = await candidate()
  expect(await deliverCandidate(input(c.id))).toMatchObject({ delivered: true })
  await db
    .update(scanCandidates)
    .set({ status: "rejected", rejectionReason: "other", decidedAt: now })
    .where(eq(scanCandidates.id, c.id))
  expect(
    await deliverCandidate(input(c.id, { now: new Date(+now + 1000) })),
  ).toMatchObject({ delivered: false })
  expect(await currentRun()).toMatchObject({
    deliveredCount: 1,
    firstDeliveredAt: now,
  })
  expect((await getRunState(run.id))?.sources[0].deliveredCount).toBe(1)
  expect(
    await db.select().from(scanCandidates).where(eq(scanCandidates.id, c.id)),
  ).toMatchObject([{ status: "rejected", readyForReviewAt: now }])
})

it("50e livraison : seuil horodaté une fois ; la 51e ne le modifie pas", async () => {
  await db
    .update(scanRuns)
    .set({ deliveredCount: 49 })
    .where(eq(scanRuns.id, run.id))
  const a = await candidate(),
    b = await candidate()
  await deliverCandidate(input(a.id))
  await deliverCandidate(input(b.id, { now: new Date(+now + 1000) }))
  expect(await currentRun()).toMatchObject({
    deliveredCount: 51,
    targetReachedAt: now,
  })
})

it("60 livraisons concurrentes (Promise.all) : compteur exact, seuil posé une fois", async () => {
  const candidates = await Promise.all(
    Array.from({ length: 60 }, () => candidate()),
  )
  const results = await Promise.all(
    candidates.flatMap((c, i) => [
      deliverCandidate(input(c.id, { now: new Date(+now + i * 1000) })),
      deliverCandidate(input(c.id, { now: new Date(+now + i * 1000) })),
    ]),
  )
  expect(results.filter((r) => "delivered" in r && r.delivered)).toHaveLength(
    60,
  )
  const reached = (await currentRun()).targetReachedAt
  expect(reached).toBeInstanceOf(Date)
  expect((await currentRun()).deliveredCount).toBe(60)
  expect((await getRunState(run.id))!.sources[0].deliveredCount).toBe(60)
  await deliverCandidate(
    input(candidates[0].id, { now: new Date(+now + 86400_000) }),
  )
  expect((await currentRun()).targetReachedAt).toEqual(reached)
})

it("reprise : l'ancien jeton ne peut livrer, exclure, échouer, découvrir ou créer une génération", async () => {
  const c = await candidate()
  const resumed = await renewClaim(run.id, now, {
    lostClaimToken: run.claimToken,
  })
  if (!resumed.ok) throw new Error("Reprise refusée")
  const old = input(c.id)
  const results = await Promise.all([
    deliverCandidate(old),
    excludeCandidate({
      candidateId: c.id,
      runId: run.id,
      token: run.claimToken,
      reason: "closed",
      now,
    }),
    recordFailure(c.id, "erreur", {
      runId: run.id,
      token: run.claimToken,
      expectedAttempts: 0,
      now,
    }),
    recordListedPosting(run.id, run.claimToken, "fixture", {
      identityKey: "lost",
      discoveryUrl: "https://hotel.example/lost",
      listingHash: "lost",
    }),
    newGeneration(c.id, { ...old, listingHash: "new" }),
  ])
  expect(
    results.every((r) => !r.ok && "reason" in r && r.reason === "superseded"),
  ).toBe(true)
  expect(await db.select().from(scanCandidates)).toEqual([c])
  expect((await currentRun()).deliveredCount).toBe(0)
  expect(
    await deliverCandidate({ ...old, token: resumed.run.claimToken }),
  ).toMatchObject({ delivered: true })
})

it("redécouverte : même dossier, lastSeenAt à jour, aucune livraison nouvelle", async () => {
  const listed = {
    identityKey: "known",
    discoveryUrl: "https://hotel.example/offres/known",
    listingHash: "v1",
    now,
  }
  const first = await recordListedPosting(
    run.id,
    run.claimToken,
    "fixture",
    listed,
  )
  if (!first.ok) throw new Error("Écriture refusée")
  expect(first.kind).toBe("new")
  await deliverCandidate(input(first.candidate.id))
  const later = new Date(+now + 1000)
  expect(
    await recordListedPosting(run.id, run.claimToken, "fixture", {
      ...listed,
      now: later,
    }),
  ).toMatchObject({
    kind: "rediscovered",
    candidate: {
      id: first.candidate.id,
      lastSeenAt: later,
      readyForReviewAt: now,
    },
  })
  expect(await db.select().from(scanCandidates)).toHaveLength(1)
  expect((await currentRun()).deliveredCount).toBe(1)
})

it("piste écartée : non relue tant que son élément de liste ne change pas", async () => {
  const listed = {
    identityKey: "excluded",
    discoveryUrl: "https://hotel.example/offres/excluded",
    listingHash: "v1",
    now,
  }
  const first = await recordListedPosting(
    run.id,
    run.claimToken,
    "fixture",
    listed,
  )
  if (!first.ok) throw new Error("Écriture refusée")
  await excludeCandidate({
    candidateId: first.candidate.id,
    runId: run.id,
    token: run.claimToken,
    reason: "closed",
    now,
  })
  expect(
    await excludeCandidate({
      candidateId: first.candidate.id,
      runId: run.id,
      token: run.claimToken,
      reason: "no_content",
      now,
    }),
  ).toMatchObject({ excluded: false })
  expect(
    await recordListedPosting(run.id, run.claimToken, "fixture", listed),
  ).toMatchObject({ kind: "skip_excluded" })
  expect(await nextPistesToProcess(run.id, "fixture", 10)).toHaveLength(0)
  expect(
    await recordListedPosting(run.id, run.claimToken, "fixture", {
      ...listed,
      listingHash: "v2",
    }),
  ).toMatchObject({
    kind: "listing_changed",
    candidate: { status: "discovered", exclusionReason: null },
  })
  expect(await nextPistesToProcess(run.id, "fixture", 10)).toHaveLength(1)
  expect((await getRunState(run.id))!.sources[0].excludedCount).toBe(1)
})

it("échec : essais idempotents et bornés ; une liste modifiée autorise une nouvelle lecture", async () => {
  const c = await candidate({ identityKey: "failed", listingHash: "v1" })
  for (let attempt = 0; attempt < 3; attempt++) {
    const context = {
      runId: run.id,
      token: run.claimToken,
      expectedAttempts: attempt,
      now,
    }
    expect(await recordFailure(c.id, "indisponible", context)).toMatchObject({
      recorded: true,
    })
    expect(await recordFailure(c.id, "rejeu", context)).toMatchObject({
      recorded: false,
    })
    expect(await nextPistesToProcess(run.id, "fixture", 10)).toHaveLength(
      attempt < 2 ? 1 : 0,
    )
  }
  const listed = {
    identityKey: "failed",
    discoveryUrl: c.discoveryUrl,
    listingHash: "v1",
    now,
  }
  expect(
    await recordListedPosting(run.id, run.claimToken, "fixture", listed),
  ).toMatchObject({ kind: "skip_excluded" })
  expect(
    await recordListedPosting(run.id, run.claimToken, "fixture", {
      ...listed,
      listingHash: "v2",
    }),
  ).toMatchObject({ kind: "listing_changed", candidate: { attempts: 0 } })
})

it("même identifiant, autre période : nouvelle génération livrée avec reused_identity ; rejeu sans doublon", async () => {
  const c = await candidate()
  await deliverCandidate(input(c.id))
  const next = input(c.id)
  next.proposal = {
    ...next.proposal,
    period: established({ startDate: "2027-12-15", endDate: "2028-04-15" }, [
      evidence,
    ]),
  }
  const delivered = await newGeneration(c.id, {
    ...next,
    listingHash: "winter-2027",
  })
  expect(delivered).toMatchObject({
    delivered: true,
    candidate: {
      generation: 2,
      identityKey: c.identityKey,
      status: "to_review",
    },
  })
  if (!("candidate" in delivered) || !delivered.candidate)
    throw new Error("Livraison manquante")
  expect(
    delivered.candidate.issues.some(
      (issue) => issue.code === "reused_identity",
    ),
  ).toBe(true)
  expect(
    await newGeneration(c.id, { ...next, listingHash: "winter-2027" }),
  ).toMatchObject({ reason: "not_other_period" })
  expect((await currentRun()).deliveredCount).toBe(2)
})

it("rejet pour admission : cumul conservé ; le seuil confirmé l'exclut, à la différence d'un minimum incomplet", async () => {
  const rows = []
  for (let i = 0; i < 51; i++) {
    const c = await candidate()
    const at = new Date(+now + i * 1000)
    await deliverCandidate(input(c.id, { now: at }))
    rows.push(c)
  }
  await db
    .update(scanCandidates)
    .set({ status: "rejected", rejectionReason: "out_of_scope" })
    .where(eq(scanCandidates.id, rows[0].id))
  await db
    .update(scanCandidates)
    .set({ status: "rejected", rejectionReason: "missing_minimum" })
    .where(eq(scanCandidates.id, rows[1].id))
  const report = await getRunReport(run.id)
  expect(report).toMatchObject({
    run: { deliveredCount: 51 },
    targetReachedAt: new Date(+now + 49_000),
    confirmedTargetReachedAt: new Date(+now + 50_000),
    firstDeliveredAt: now,
    firstDeliveryDelayMs: 0,
    deliveredBeforeDeadline: 51,
  })
  expect(report!.byStatus).toEqual(
    expect.arrayContaining([
      { status: "rejected", count: 2 },
      { status: "to_review", count: 49 },
    ]),
  )
  expect(report!.rejections).toEqual(
    expect.arrayContaining([
      { reason: "out_of_scope", count: 1 },
      { reason: "missing_minimum", count: 1 },
    ]),
  )
})

it("bilan : délai, échéance, exclusions et publications humaines/automatiques séparées", async () => {
  const [company] = await db
    .insert(companies)
    .values({ legalName: "Bilan scan fictif" })
    .returning()
  const offerIds: string[] = []
  try {
    for (const [i, kind] of (["human", "automatic"] as const).entries()) {
      const c = await candidate()
      await deliverCandidate(
        input(c.id, { now: new Date(+now + (i ? 7 * 3600_000 : 1000)) }),
      )
      const [offer] = await db
        .insert(offers)
        .values({
          origin: "collected",
          companyId: company.id,
          title: `Bilan scan ${kind}`,
          season: "summer",
          communeName: "Lacanau",
          departmentCode: "33",
          durationValue: 3,
          durationUnit: "months",
          applyEmail: "rh@hotel.example",
          sourceUrl: c.discoveryUrl,
          sourceCheckedAt: now,
        })
        .returning()
      offerIds.push(offer.id)
      await db
        .update(scanCandidates)
        .set({ status: "published", offerId: offer.id, publicationKind: kind })
        .where(eq(scanCandidates.id, c.id))
    }
    const excluded = await candidate()
    await excludeCandidate({
      candidateId: excluded.id,
      runId: run.id,
      token: run.claimToken,
      reason: "closed",
      now,
    })
    expect(await getRunReport(run.id)).toMatchObject({
      firstDeliveryDelayMs: 1000,
      deliveredBeforeDeadline: 1,
      publications: { human: 1, automatic: 1 },
      exclusions: [{ reason: "closed", count: 1 }],
      confirmedTargetReachedAt: null,
    })
    await resetScan(db.$client)
    expect(
      await db.select().from(offers).where(eq(offers.companyId, company.id)),
    ).toHaveLength(2)
  } finally {
    await resetScan(db.$client)
    for (const id of offerIds) await db.delete(offers).where(eq(offers.id, id))
    await db.delete(companies).where(eq(companies.id, company.id))
  }
})

it("SH13 : texte, nombre d'observations et extraits bornés à l'écriture, avec alerte de troncature", async () => {
  const c = await candidate()
  const extraction = posting({
    usefulText: "😀".repeat(20_100),
    observations: Array.from({ length: 210 }, () =>
      observation("é".repeat(400)),
    ),
  })
  await deliverCandidate(input(c.id, { extraction }))
  const [stored] = await db
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, c.id))
  expect(Array.from(stored.pageText!)).toHaveLength(20_000)
  expect(stored.observations).toHaveLength(200)
  expect(stored.observations[0].evidence.excerpt).toHaveLength(300)
  expect(stored.issues.some((issue) => issue.code === "text_truncated")).toBe(
    true,
  )
  expect(extraction.observations).toHaveLength(210)
})

it("livraison annulée si la source n'est pas initialisée : dossier et compteur intacts", async () => {
  await insertScanSource(db.$client, { key: "uninitialized" })
  const c = await candidate({ sourceKey: "uninitialized" })
  await expect(deliverCandidate(input(c.id))).rejects.toThrow("non initialisée")
  expect((await currentRun()).deliveredCount).toBe(0)
  expect(
    await db.select().from(scanCandidates).where(eq(scanCandidates.id, c.id)),
  ).toEqual([c])
})

describe("contraintes des dossiers et revues", () => {
  it.each([
    { status: "excluded" as const },
    { exclusionReason: "closed" as const },
    { status: "rejected" as const },
    { rejectionReason: "duplicate" as const },
    { status: "published" as const },
    { publicationKind: "human" as const },
    { status: "to_review" as const },
    { sourcePublishedAt: now },
    { pageText: "x".repeat(20_001) },
    { observations: Array.from({ length: 201 }, () => observation("x")) },
    { generation: 0 },
    { version: 0 },
    {
      readyForReviewAt: now,
      deliveredRunId: "00000000-0000-0000-0000-000000000000",
    },
  ])("refuse une combinaison incohérente %j", async (patch) => {
    const c = await candidate()
    await expect(
      db.update(scanCandidates).set(patch).where(eq(scanCandidates.id, c.id)),
    ).rejects.toThrow()
  })
  it.each(["duplicate", "divergence", "incident"] as const)(
    "refuse une revue %s sans ses références",
    async (kind) => {
      await expect(
        db.insert(scanReviews).values({ kind, groupKey: "invalid" }),
      ).rejects.toThrow()
    },
  )
  it("unicité des revues et cohérence décision/statut", async () => {
    await db
      .insert(scanReviews)
      .values({ kind: "incident", sourceKey: "fixture", groupKey: "incident" })
    await expect(
      db.insert(scanReviews).values({
        kind: "incident",
        sourceKey: "fixture",
        groupKey: "incident",
      }),
    ).rejects.toThrow()
    await expect(
      db.update(scanReviews).set({ status: "resolved" }),
    ).rejects.toThrow()
    await db.update(scanReviews).set({ status: "resolved", decidedAt: now })
    await expect(
      db.update(scanReviews).set({ status: "open" }),
    ).rejects.toThrow()
  })
  it("unicité de l'identité et absence de compteur négatif", async () => {
    const c = await candidate()
    await expect(candidate({ identityKey: c.identityKey })).rejects.toThrow()
    await expect(
      db
        .update(scanRunSources)
        .set({ deliveredCount: -1 })
        .where(
          and(
            eq(scanRunSources.runId, run.id),
            eq(scanRunSources.sourceKey, "fixture"),
          ),
        ),
    ).rejects.toThrow()
    // Le type SQL JSON doit aussi être une liste.
    await expect(
      db
        .update(scanCandidates)
        .set({ observations: sql`'{}'::jsonb` })
        .where(eq(scanCandidates.id, c.id)),
    ).rejects.toThrow()
  })
})
