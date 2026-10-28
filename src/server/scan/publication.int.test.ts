import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, it } from "vitest"

import {
  enableScanSource,
  insertScanCandidate,
} from "../../../e2e/helpers/scan"

import { admitPosting } from "@/domain/scan/admission"
import { absent, established } from "@/domain/scan/field"
import { admissionContext } from "@/domain/scan/rules-fixtures"
import { discoveryWindow } from "@/domain/scan/window"
import { db } from "@/lib/db"
import {
  blockedDomains,
  offers,
  offerLocations,
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

import { stageCandidate } from "./candidates"
import { publishCandidate } from "./publication"
import { getRunReport } from "./queries"
import { setSourceSwitch } from "./sources/writes"

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

async function discoveredOnFranceTravail() {
  await enableScanSource(db.$client, "france-travail", { daily: true })
  await db
    .update(scanCandidates)
    .set({
      sourceKey: "france-travail",
      discoveryUrl:
        "https://candidat.francetravail.fr/offres/recherche/detail/215QHWT",
      officialUrl: null,
      proposal: { ...fixture.proposal, officialUrl: absent() },
    })
    .where(eq(scanCandidates.id, fixture.candidate.id))
}

it("un dossier France Travail peut être publié après vérification humaine de la source employeur", async () => {
  await discoveredOnFranceTravail()
  const sourceUrl = "https://recrutement.hotel.example/jobs/serveur"
  const result = await publishCandidate({
    ...fixture.request,
    input: { ...fixture.input, sourceUrl, sourceName: "Employeur fictif" },
  })
  expect(result).toMatchObject({ ok: true, created: true })
  if (!result.ok) return
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.id, result.offerId))
  expect(offer).toMatchObject({
    sourceUrl,
    humanVerifiedAt: publicationNow,
    humanVerifiedByUserId: fixture.adminId,
  })
  expect(await stored()).toMatchObject({
    sourceKey: "france-travail",
    discoveryUrl:
      "https://candidat.francetravail.fr/offres/recherche/detail/215QHWT",
    publicationKind: "human",
  })
})

it.each([
  "https://candidat.francetravail.fr/offres/recherche/detail/215QHWT",
  "https://fr.indeed.com/viewjob?jk=123",
])(
  "la revue France Travail refuse une source job-board : %s",
  async (sourceUrl) => {
    await discoveredOnFranceTravail()
    expect(
      await publishCandidate({
        ...fixture.request,
        input: { ...fixture.input, sourceUrl },
      }),
    ).toMatchObject({
      ok: false,
      reason: "blocked",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "blocked_domain" }),
      ]),
    })
    expect(await stored()).toMatchObject({ status: "to_review", offerId: null })
  },
)

it("France Travail reste sans publication automatique, même avec une URL employeur proposée", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await discoveredOnFranceTravail()
  await fixture.discovered()
  await db
    .update(scanCandidates)
    .set({ proposal: fixture.proposal })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    reason: "blocked",
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "official_source" }),
    ]),
  })
})

it("une découverte refuse la publication automatique, en base comme par le service", async () => {
  await expect(
    db
      .update(scanSources)
      .set({ autoPublish: true })
      .where(eq(scanSources.key, "france-travail")),
  ).rejects.toThrow()
  await expect(
    enableScanSource(db.$client, "france-travail", { autoPublish: true }),
  ).rejects.toThrow("découverte")
  expect(
    await setSourceSwitch(
      "france-travail",
      "autoPublish",
      true,
      fixture.adminId,
    ),
  ).toMatchObject({ ok: false, reason: "blocked" })
})

it("deux validations simultanées et leur rejeu donnent une seule annonce vérifiée par un humain", async () => {
  const results = await Promise.all([
    publishCandidate(fixture.request),
    publishCandidate(fixture.request),
  ])
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.companyId, fixture.company.id))
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ ok: true, created: true }),
      { ok: false, reason: "already_published", offerId: offer.id },
    ]),
  )
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
    ok: false,
    reason: "already_published",
    offerId: offer.id,
  })
})

it("une seconde validation humaine aux valeurs corrigées est refusée, l'annonce reste inchangée", async () => {
  const first = await publishCandidate(fixture.request)
  if (!first.ok) throw new Error("Fixture publication failed")
  const second = await publishCandidate({
    ...fixture.request,
    input: { ...fixture.input, title: "Intitulé corrigé dans un autre onglet" },
  })
  expect(second).toEqual({
    ok: false,
    reason: "already_published",
    offerId: first.offerId,
  })
  const [offer] = await db
    .select({ title: offers.title })
    .from(offers)
    .where(eq(offers.id, first.offerId))
  expect(offer.title).toBe(fixture.input.title)
})

it("rejeu d'une étape du scan après publication : la publication existante est constatée", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  const first = await publishCandidate(fixture.scanRequest)
  if (!first.ok) throw new Error(JSON.stringify(first))
  expect(await publishCandidate(fixture.scanRequest)).toEqual({
    ok: true,
    created: false,
    offerId: first.offerId,
  })
})

it.each([
  ["151,67 heures hebdomadaires", 151.67],
  ["70 heures hebdomadaires", 70],
])(
  "publication automatique : des heures hors plage (%s) restent dans les preuves, sans erreur SQL",
  async (_label, weeklyHours) => {
    await fixture.cleanup()
    fixture = await createPublicationFixture("daily")
    await fixture.discovered()
    await db
      .update(scanCandidates)
      .set({
        proposal: {
          ...fixture.proposal,
          conditions: {
            ...fixture.proposal.conditions,
            weeklyHours: established(
              weeklyHours,
              fixture.proposal.title.evidence,
            ),
          },
        },
      })
      .where(eq(scanCandidates.id, fixture.candidate.id))
    // Hors plage : la conversion n'en fait pas une valeur d'annonce, la publication se poursuit.
    const result = await publishCandidate(fixture.scanRequest)
    expect(result).toMatchObject({ ok: true, created: true })
    if (!result.ok) return
    const [offer] = await db
      .select({ weeklyHours: offers.weeklyHours })
      .from(offers)
      .where(eq(offers.id, result.offerId))
    expect(offer.weeklyHours).toBeNull()
  },
)

it("publication automatique : un texte au-delà des bornes du formulaire est refusé avec un motif", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  await db
    .update(scanCandidates)
    .set({
      proposal: {
        ...fixture.proposal,
        profile: established("x".repeat(600), fixture.proposal.title.evidence),
      },
    })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: false,
    reason: "blocked",
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "invalid_values" }),
    ]),
  })
  expect(await stored()).toMatchObject({ offerId: null })
})

it("version périmée : refuse sans modifier le dossier", async () => {
  expect(
    await publishCandidate({ ...fixture.request, version: 99 }),
  ).toMatchObject({ ok: false, reason: "conflict" })
  expect(await stored()).toEqual(fixture.candidate)
})

it("la revue publie tous les lieux atomiquement et le rejeu ne les duplique pas", async () => {
  const request = {
    ...fixture.request,
    input: {
      ...fixture.input,
      extraLocations: [
        {
          communeName: "Lacanau",
          communeInseeCode: "33214",
          departmentCode: "33",
          postalCode: "33680",
          locationDetails: "Au lac",
        },
      ],
    },
  }
  const result = await publishCandidate(request)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  await publishCandidate(request)
  const locations = await db
    .select()
    .from(offerLocations)
    .where(eq(offerLocations.offerId, result.offerId))
  expect(locations).toHaveLength(1)
  expect(locations[0]).toMatchObject({ position: 1, communeName: "Lacanau" })
})

it("un département supplémentaire inconnu bloque avant publication", async () => {
  const result = await publishCandidate({
    ...fixture.request,
    input: {
      ...fixture.input,
      extraLocations: [
        {
          communeName: "Inconnue",
          departmentCode: "00",
          communeInseeCode: null,
          postalCode: null,
          locationDetails: null,
        },
      ],
    },
  })
  expect(result).toMatchObject({ ok: false, reason: "blocked" })
  expect(
    await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, fixture.company.id)),
  ).toEqual([])
})

it("la publication automatique conserve tous les lieux établis", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  await db
    .update(scanCandidates)
    .set({
      proposal: {
        ...fixture.proposal,
        locations: established(
          [
            {
              communeName: "Chamonix",
              departmentCode: "74",
              country: "France",
            },
            { communeName: "Lacanau", departmentCode: "33", country: "France" },
          ],
          fixture.proposal.locations.evidence,
        ),
      },
    })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  const result = await publishCandidate(fixture.scanRequest)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(
    await db
      .select()
      .from(offerLocations)
      .where(eq(offerLocations.offerId, result.offerId)),
  ).toMatchObject([{ communeName: "Lacanau", departmentCode: "33" }])
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

it("étape du scan : le dossier préparé par stageCandidate est publié « Sourcée sur internet » et compté au bilan (plan scan 09)", async () => {
  await fixture.cleanup()
  fixture = await createPublicationFixture("daily")
  await fixture.discovered()
  await db
    .update(scanCandidates)
    .set({ proposal: null, lastFetchedAt: null })
    .where(eq(scanCandidates.id, fixture.candidate.id))
  const admission = admitPosting(fixture.extraction, {
    ...admissionContext,
    window: discoveryWindow("daily", fixture.run.startedAt),
    source: { kind: "employer", officialHosts: ["recrute.belambra.fr"] },
  })
  if (!admission.admitted) throw new Error("Fixture non admise")
  expect(
    await stageCandidate({
      candidateId: fixture.candidate.id,
      runId: fixture.run.id,
      token: fixture.run.claimToken,
      extraction: fixture.extraction,
      admission,
      proposal: admission.proposal,
      now: publicationNow,
    }),
  ).toEqual({ ok: true, staged: true })
  expect(await publishCandidate(fixture.scanRequest)).toMatchObject({
    ok: true,
    created: true,
  })
  expect(await stored()).toMatchObject({
    status: "published",
    publicationKind: "automatic",
    readyForReviewAt: null,
    deliveredRunId: fixture.run.id,
  })
  expect((await getRunReport(fixture.run.id))?.publications).toEqual({
    human: 0,
    automatic: 1,
  })
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
      ok: false,
      reason: "already_published",
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
  await db.insert(scanReviews).values({
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
