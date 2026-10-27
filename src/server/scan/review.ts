import "server-only"

import { and, asc, eq, ne, or } from "drizzle-orm"

import { valueOf } from "@/domain/scan/field"
import type { RejectionReason } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  companies,
  offers,
  scanCandidates,
  scanReviews,
  scanRuns,
} from "@/lib/db/schema"
import { isUuid } from "@/server/offers/queries"

import { closeDuplicateReviews } from "./duplicates"

export const reviewConflictMessage =
  "Ce dossier a changé depuis son ouverture : rechargez la page"
export async function getCandidateForReview(id: string) {
  if (!isUuid(id)) return null
  const [candidate] = await db
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, id))
  if (!candidate) return null
  const company = candidate.proposal
    ? valueOf(candidate.proposal.company)
    : undefined
  const [companyRows, reviews, runRows] = await Promise.all([
    company
      ? db
          .select({ id: companies.id })
          .from(companies)
          .where(
            company.siren
              ? eq(companies.siren, company.siren)
              : eq(companies.legalName, company.name),
          )
          .limit(1)
      : [],
    db
      .select()
      .from(scanReviews)
      .where(
        and(
          eq(scanReviews.status, "open"),
          or(
            eq(scanReviews.candidateId, id),
            eq(scanReviews.otherCandidateId, id),
            candidate.occupationReviewId
              ? eq(scanReviews.id, candidate.occupationReviewId)
              : undefined,
          ),
        ),
      ),
    db
      .select({ id: scanRuns.id, mode: scanRuns.mode, status: scanRuns.status })
      .from(scanRuns)
      .where(eq(scanRuns.id, candidate.deliveredRunId ?? candidate.firstRunId))
      .limit(1),
  ])
  const duplicates = await Promise.all(
    reviews
      .filter((review) => review.kind === "duplicate")
      .map(async (review) => {
        const otherId =
          review.candidateId === id
            ? review.otherCandidateId
            : review.candidateId
        const [other] = review.offerId
          ? await db
              .select({ title: offers.title })
              .from(offers)
              .where(eq(offers.id, review.offerId))
          : otherId
            ? await db
                .select({ title: scanCandidates.title })
                .from(scanCandidates)
                .where(eq(scanCandidates.id, otherId))
            : []
        return {
          id: review.id,
          title: other?.title ?? "Recrutement rapproché",
          href: review.offerId
            ? `/admin/annonces/${review.offerId}/modifier`
            : `/admin/scan/dossiers/${otherId}`,
        }
      }),
  )
  return {
    candidate,
    companyId: companyRows[0]?.id ?? null,
    reviews,
    duplicates,
    run: runRows[0] ?? null,
  }
}
export async function nextReviewPath(exceptId: string) {
  const [candidate] = await db
    .select({ id: scanCandidates.id })
    .from(scanCandidates)
    .where(
      and(
        eq(scanCandidates.status, "to_review"),
        ne(scanCandidates.id, exceptId),
      ),
    )
    .orderBy(asc(scanCandidates.readyForReviewAt), asc(scanCandidates.id))
    .limit(1)
  return candidate
    ? `/admin/scan/dossiers/${candidate.id}`
    : "/admin/scan/dossiers"
}
export async function rejectCandidate(
  candidateId: string,
  version: number,
  reason: RejectionReason,
  note: string | undefined,
  adminId: string,
) {
  if (!isUuid(candidateId))
    return { ok: false, message: reviewConflictMessage } as const
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, candidateId))
      .for("update")
    if (
      !candidate ||
      candidate.status !== "to_review" ||
      candidate.version !== version
    )
      return { ok: false, message: reviewConflictMessage } as const
    const now = new Date()
    await tx
      .update(scanCandidates)
      .set({
        status: "rejected",
        rejectionReason: reason,
        reviewNote: note?.trim() || null,
        decidedAt: now,
        decidedByUserId: adminId,
        version: candidate.version + 1,
      })
      .where(eq(scanCandidates.id, candidateId))
    await closeDuplicateReviews(tx, candidateId, adminId, now)
    return { ok: true } as const
  })
}
