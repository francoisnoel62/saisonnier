import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ requireRole: mocks.requireRole }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { adminOfferToFormValues } from "@/domain/offer-input"
import { db } from "@/lib/db"
import {
  occupations,
  offers,
  scanCandidates,
  scanReviews,
} from "@/lib/db/schema"
import {
  createPublicationFixture,
  type PublicationFixture,
} from "@/test/scan-publication"

import { rejectScanCandidate, validateScanCandidate } from "./review-actions"
import { getScanSnapshot } from "./snapshot"

let fixture: PublicationFixture
beforeEach(async () => {
  fixture = await createPublicationFixture()
  mocks.requireRole.mockResolvedValue({ user: { id: fixture.adminId } })
  mocks.revalidatePath.mockClear()
})
afterEach(() => fixture.cleanup())
const values = () => adminOfferToFormValues(fixture.input)
it("les actions de revue vérifient le rôle avant toute écriture", async () => {
  mocks.requireRole.mockRejectedValue(new Error("forbidden"))
  await expect(
    validateScanCandidate(fixture.candidate.id, 1, values()),
  ).rejects.toThrow("forbidden")
  await expect(
    rejectScanCandidate(fixture.candidate.id, 1, "other"),
  ).rejects.toThrow("forbidden")
  expect(
    await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, fixture.company.id)),
  ).toHaveLength(0)
})
it("minimum manquant : erreurs par champ, saisie et dossier conservés", async () => {
  expect(
    await validateScanCandidate(fixture.candidate.id, 1, {
      ...values(),
      communeName: "",
    }),
  ).toMatchObject({
    ok: false,
    fieldErrors: { communeName: expect.any(Array) },
  })
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0],
  ).toEqual(fixture.candidate)
})
it("hôte non officiel refusé ; validation sans modification publiée et attribuée à l'humain", async () => {
  expect(
    await validateScanCandidate(fixture.candidate.id, 1, {
      ...values(),
      sourceUrl: "https://intrus.example/job",
    }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("Source officielle"),
  })
  const result = await validateScanCandidate(fixture.candidate.id, 1, values())
  expect(result).toMatchObject({
    ok: true,
    status: "published",
    next: "/admin/scan/dossiers",
  })
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.companyId, fixture.company.id))
  expect(offer.humanVerifiedAt).not.toBeNull()
  expect(offer.humanVerifiedByUserId).toBe(fixture.adminId)
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin", "layout")
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/offres", "layout")
})
it("métier proposé puis désactivé : la validation l'accepte comme la page du dossier (plan scan 09)", async () => {
  const [occupation] = await db
    .insert(occupations)
    .values({
      slug: `metier-desactive-${fixture.candidate.id}`,
      label: "Métier désactivé depuis la suggestion",
      family: "Test",
      isActive: false,
    })
    .returning()
  try {
    await db
      .update(scanCandidates)
      .set({
        proposal: { ...fixture.proposal, occupationId: occupation.id },
      })
      .where(eq(scanCandidates.id, fixture.candidate.id))
    expect(
      await validateScanCandidate(fixture.candidate.id, 1, {
        ...values(),
        occupationId: occupation.id,
      }),
    ).toMatchObject({ ok: true, status: "published" })
  } finally {
    // L'annonce publiée cite le métier : la nettoyer d'abord (afterEach la retrouve absente).
    await fixture.cleanup()
    await db.delete(occupations).where(eq(occupations.id, occupation.id))
  }
})
it("rejet : version périmée refusée, motif et auteur conservés après décision", async () => {
  expect(
    await rejectScanCandidate(fixture.candidate.id, 2, "missing_minimum"),
  ).toMatchObject({ ok: false, message: expect.stringContaining("a changé") })
  expect(
    await rejectScanCandidate(
      fixture.candidate.id,
      1,
      "other",
      "Dossier hors périmètre",
    ),
  ).toMatchObject({ ok: true })
  expect(
    (
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.id, fixture.candidate.id))
    )[0],
  ).toMatchObject({
    status: "rejected",
    rejectionReason: "other",
    reviewNote: "Dossier hors périmètre",
    decidedByUserId: fixture.adminId,
    version: 2,
  })
})
it("état : compteurs et liste bornée, curseur stable, aucun texte de page ni coordonnée", async () => {
  await db.insert(scanCandidates).values(
    Array.from({ length: 53 }, (_, index) => ({
      sourceKey: "belambra",
      identityKey: crypto.randomUUID(),
      listingHash: "listed",
      firstRunId: fixture.run.id,
      discoveryUrl: "https://recrute.belambra.fr/jobs/123-serveur",
      status: "to_review" as const,
      title: `Dossier ${index}`,
      readyForReviewAt: new Date(
        +fixture.candidate.readyForReviewAt! + index + 1,
      ),
      deliveredRunId: fixture.run.id,
      proposal: fixture.proposal,
      pageText: "Texte privé à ne pas transmettre",
    })),
  )
  const first = await getScanSnapshot()
  expect(first.counts.toReview).toBe(54)
  expect(first.items).toHaveLength(50)
  expect(first.nextCursor).not.toBeNull()
  const next = await getScanSnapshot({ after: first.nextCursor })
  expect(next.items).toHaveLength(4)
  expect(
    new Set([...first.items, ...next.items].map((item) => item.id)).size,
  ).toBe(54)
  expect(JSON.stringify(first)).not.toContain("recrutement@hotel.example")
  expect(JSON.stringify(first)).not.toContain("Texte privé")
  await db.insert(scanReviews).values({
    kind: "duplicate",
    groupKey: "snapshot-duplicate",
    candidateId: fixture.candidate.id,
    otherCandidateId: first.items.find(
      (item) => item.id !== fixture.candidate.id,
    )!.id,
  })
  expect(
    (await getScanSnapshot({ trackedIds: [fixture.candidate.id] })).tracked[0]
      .blockingCount,
  ).toBe(1)
  await rejectScanCandidate(fixture.candidate.id, 1, "other")
  expect(
    (await getScanSnapshot({ trackedIds: [fixture.candidate.id] })).tracked,
  ).toMatchObject([{ id: fixture.candidate.id, status: "rejected" }])
  await expect(getScanSnapshot({ after: "pas-un-curseur" })).rejects.toThrow(
    "Curseur invalide",
  )
})
