import "server-only"

import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm"

import { absent, valueOf } from "@/domain/scan/field"
import { canonicalUrl, compareRecruitment } from "@/domain/scan/identity"
import type { Period } from "@/domain/scan/period"
import type { ScanProposal } from "@/domain/scan/proposal"
import { normalizeJobTitle } from "@/domain/scan/title"
import { db } from "@/lib/db"
import {
  companies,
  offers,
  scanCandidates,
  scanReviews,
  type ScanCandidate,
} from "@/lib/db/schema"
import { isUuid } from "@/server/offers/queries"

import type { ScanTransaction } from "./claim"

export type DuplicateSuspect = { kind: "offer" | "candidate"; id: string }
function matchingRecruitment(
  proposal: ScanProposal,
  title: string,
  period?: ScanProposal["period"] | null,
) {
  return (
    normalizeJobTitle(valueOf(proposal.title) ?? "") ===
      normalizeJobTitle(title) &&
    compareRecruitment(
      { title, period: period ?? absent() },
      { title, period: proposal.period },
    ) !== "other_period"
  )
}
const reviewGroup = (candidateId: string, suspect: DuplicateSuspect) =>
  [`candidate:${candidateId}`, `${suspect.kind}:${suspect.id}`].sort().join("|")

export async function findDuplicateSuspects(
  candidate: Pick<ScanCandidate, "id">,
  proposal: ScanProposal,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, candidate.id))
      .for("update")
    if (
      !current ||
      !["discovered", "failed", "to_review"].includes(current.status)
    )
      return { alreadyKnown: false, suspects: [] as DuplicateSuspect[] }
    const name = valueOf(proposal.company)
    const company = name
      ? (
          await tx
            .select()
            .from(companies)
            .where(
              name.siren
                ? eq(companies.siren, name.siren)
                : eq(companies.legalName, name.name),
            )
            .limit(1)
        )[0]
      : undefined
    const places = valueOf(proposal.locations) ?? []
    const sourceUrl = canonicalUrl(
      valueOf(proposal.officialUrl) ??
        current.officialUrl ??
        current.discoveryUrl,
    )
    const suspects: DuplicateSuspect[] = []
    const linkedCandidates = await tx
      .select({ id: scanCandidates.id, offerId: scanCandidates.offerId })
      .from(scanCandidates)
      .where(isNotNull(scanCandidates.offerId))
    const knownOffers = await tx
      .select()
      .from(offers)
      .where(ne(offers.status, "rejected"))
    for (const offer of knownOffers) {
      const sameUrl =
        !!sourceUrl &&
        !!offer.sourceUrl &&
        canonicalUrl(offer.sourceUrl) === sourceUrl
      const samePlace = places.some(
        (place) => place.departmentCode === offer.departmentCode,
      )
      const period: Period = {
        ...(offer.startDate ? { startDate: offer.startDate } : {}),
        ...(offer.endDate ? { endDate: offer.endDate } : {}),
        ...(offer.durationValue && offer.durationUnit
          ? {
              duration: {
                value: offer.durationValue,
                unit: offer.durationUnit,
              },
            }
          : {}),
      }
      const same =
        samePlace &&
        (!company || company.id === offer.companyId) &&
        matchingRecruitment(proposal, offer.title, {
          status: "established",
          value: period,
          evidence: [],
        })
      // Une saisie manuelle du même recrutement est connue, quelle que soit sa visibilité.
      if (sameUrl && same && offer.origin === "collected") {
        if (current.status !== "to_review") {
          await tx
            .update(scanCandidates)
            .set({
              status: "excluded",
              exclusionReason: "already_known",
              exclusionDetail: `/admin/annonces/${offer.id}/modifier`,
              version: current.version + 1,
            })
            .where(eq(scanCandidates.id, current.id))
          return {
            alreadyKnown: true,
            offerId: offer.id,
            suspects: [] as DuplicateSuspect[],
          }
        }
      }
      if (sameUrl || same) {
        // Une publication ne change pas l'identité d'une paire déjà décidée entre dossiers.
        const linked = linkedCandidates.find((row) => row.offerId === offer.id)
        suspects.push(
          linked
            ? { kind: "candidate", id: linked.id }
            : { kind: "offer", id: offer.id },
        )
      }
    }
    const dossiers = await tx
      .select()
      .from(scanCandidates)
      .where(
        and(
          ne(scanCandidates.id, current.id),
          isNotNull(scanCandidates.readyForReviewAt),
          ne(scanCandidates.status, "rejected"),
        ),
      )
    for (const other of dossiers) {
      if (other.offerId || !other.proposal || !other.title) continue
      const otherCompany = valueOf(other.proposal.company)
      const sameCompany =
        !name ||
        !otherCompany ||
        (name.siren && otherCompany.siren
          ? name.siren === otherCompany.siren
          : normalizeJobTitle(name.name) ===
            normalizeJobTitle(otherCompany.name))
      const samePlace = valueOf(other.proposal.locations)?.some((place) =>
        places.some((p) => p.departmentCode === place.departmentCode),
      )
      if (
        sameCompany &&
        samePlace &&
        matchingRecruitment(proposal, other.title, other.proposal.period)
      )
        suspects.push({ kind: "candidate", id: other.id })
    }
    for (const suspect of suspects) {
      // Une décision persistante n'est jamais rouverte par une redécouverte.
      await tx
        .insert(scanReviews)
        .values({
          kind: "duplicate",
          groupKey: reviewGroup(current.id, suspect),
          candidateId: current.id,
          ...(suspect.kind === "offer"
            ? { offerId: suspect.id }
            : { otherCandidateId: suspect.id }),
        })
        .onConflictDoUpdate({
          target: [scanReviews.kind, scanReviews.groupKey],
          set: { lastSeenAt: new Date() },
          setWhere: eq(scanReviews.status, "open"),
        })
    }
    return { alreadyKnown: false, suspects }
  })
}

export async function closeDuplicateReviews(
  tx: ScanTransaction,
  candidateId: string,
  adminId: string,
  now: Date,
) {
  await tx
    .update(scanReviews)
    .set({
      status: "resolved",
      decidedAt: now,
      decidedByUserId: adminId,
      decision: { reason: "candidate_rejected" },
    })
    .where(
      and(
        eq(scanReviews.kind, "duplicate"),
        eq(scanReviews.status, "open"),
        or(
          eq(scanReviews.candidateId, candidateId),
          eq(scanReviews.otherCandidateId, candidateId),
        ),
      ),
    )
}

export async function decideDuplicate(
  reviewId: string,
  decision: "duplicate" | "distinct",
  adminId: string,
  note?: string,
) {
  if (!isUuid(reviewId) || !["duplicate", "distinct"].includes(decision))
    return { ok: false, reason: "conflict" } as const
  return db.transaction(async (tx) => {
    const [reference] = await tx
      .select()
      .from(scanReviews)
      .where(
        and(eq(scanReviews.id, reviewId), eq(scanReviews.kind, "duplicate")),
      )
    if (!reference?.candidateId)
      return { ok: false, reason: "conflict" } as const
    // Même ordre que la publication : dossier puis revue.
    const [candidate] = await tx
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, reference.candidateId))
      .for("update")
    const [review] = await tx
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.id, reviewId))
      .for("update")
    if (
      !candidate ||
      candidate.status !== "to_review" ||
      review.status !== "open"
    )
      return { ok: false, reason: "conflict" } as const
    const now = new Date()
    await tx
      .update(scanReviews)
      .set({
        status: "resolved",
        decidedAt: now,
        decidedByUserId: adminId,
        decision: { kind: decision, note: note?.slice(0, 2000) ?? null },
      })
      .where(eq(scanReviews.id, reviewId))
    if (decision === "duplicate") {
      await tx
        .update(scanCandidates)
        .set({
          status: "rejected",
          rejectionReason: "duplicate",
          decidedAt: now,
          decidedByUserId: adminId,
          reviewNote: note?.slice(0, 2000) ?? null,
          version: sql`${scanCandidates.version} + 1`,
        })
        .where(eq(scanCandidates.id, candidate.id))
      await closeDuplicateReviews(tx, candidate.id, adminId, now)
    }
    return { ok: true } as const
  })
}
