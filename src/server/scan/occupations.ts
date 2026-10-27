import "server-only"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { occupationSchema, type OccupationInput } from "@/domain/occupation"
import { normalizeJobTitle } from "@/domain/scan/title"
import { scanIssue, uniqueIssues } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  occupationAliases,
  occupations,
  offers,
  scanCandidates,
  scanReviews,
  type ScanCandidate,
} from "@/lib/db/schema"
import { addOccupation } from "@/server/referentials/admin"
import { isUuid } from "@/server/offers/queries"

import { withRunClaim, type ScanTransaction } from "./claim"

export async function attachOccupationInTransaction(
  tx: ScanTransaction,
  candidate: ScanCandidate,
) {
  if (
    !candidate.title ||
    !candidate.proposal ||
    candidate.occupationReviewId ||
    candidate.proposal.occupationId
  )
    return candidate
  const normalizedLabel = normalizeJobTitle(candidate.title)
  if (!normalizedLabel) return candidate
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('scan-occupation'), hashtext(${normalizedLabel}))`,
  )
  const [alias] = await tx
    .select({ id: occupations.id })
    .from(occupationAliases)
    .innerJoin(occupations, eq(occupations.id, occupationAliases.occupationId))
    .where(
      and(
        eq(occupationAliases.normalizedLabel, normalizedLabel),
        eq(occupations.isActive, true),
      ),
    )
  const active = alias
    ? []
    : await tx
        .select({ id: occupations.id, label: occupations.label })
        .from(occupations)
        .where(eq(occupations.isActive, true))
  const occupation =
    alias ??
    active.find(
      (occupation) => normalizeJobTitle(occupation.label) === normalizedLabel,
    )
  if (occupation) {
    const [updated] = await tx
      .update(scanCandidates)
      .set({
        proposal: { ...candidate.proposal, occupationId: occupation.id },
        issues: candidate.issues.filter(
          (issue) => issue.code !== "occupation_unknown",
        ),
      })
      .where(eq(scanCandidates.id, candidate.id))
      .returning()
    return updated
  }
  const [review] = await tx
    .insert(scanReviews)
    .values({
      kind: "occupation",
      groupKey: `occupation:${normalizedLabel}`,
      candidateId: candidate.id,
      details: {
        title: candidate.title,
        normalizedLabel,
        context: candidate.pageText?.slice(0, 300) ?? "",
      },
    })
    .onConflictDoUpdate({
      target: [scanReviews.kind, scanReviews.groupKey],
      set: {
        occurrences: sql`${scanReviews.occurrences} + 1`,
        lastSeenAt: new Date(),
      },
    })
    .returning()
  const [updated] = await tx
    .update(scanCandidates)
    .set({
      occupationReviewId: review.id,
      issues:
        review.status === "open"
          ? uniqueIssues([...candidate.issues, scanIssue("occupation_unknown")])
          : candidate.issues.filter(
              (issue) => issue.code !== "occupation_unknown",
            ),
    })
    .where(eq(scanCandidates.id, candidate.id))
    .returning()
  return updated
}
export function attachOccupation(
  candidateId: string,
  claim: { runId: string; token: string },
) {
  return withRunClaim(claim.runId, claim.token, async (tx) => {
    const [candidate] = await tx
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, candidateId))
      .for("update")
    if (!candidate || candidate.status !== "to_review")
      return { ok: false, reason: "conflict" } as const
    return {
      ok: true,
      candidate: await attachOccupationInTransaction(tx, candidate),
    } as const
  })
}
export type OccupationDecision =
  | { kind: "attach"; occupationId: string }
  | { kind: "create"; input: OccupationInput }
  | { kind: "reject" }
export async function decideOccupation(
  reviewId: string,
  decision: OccupationDecision,
  adminId: string,
) {
  if (!isUuid(reviewId))
    return { ok: false, message: "Suggestion inconnue." } as const
  return db.transaction(async (tx) => {
    const [reference] = await tx
      .select()
      .from(scanReviews)
      .where(
        and(eq(scanReviews.id, reviewId), eq(scanReviews.kind, "occupation")),
      )
    if (!reference)
      return { ok: false, message: "Suggestion inconnue." } as const
    const normalizedLabel = reference.groupKey.slice("occupation:".length)
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('scan-occupation'), hashtext(${normalizedLabel}))`,
    )
    const [review] = await tx
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.id, reviewId))
      .for("update")
    if (review.status !== "open")
      return {
        ok: false,
        message: "Cette suggestion a déjà été traitée.",
      } as const
    let occupationId: string | null = null
    if (decision.kind === "create") {
      const parsed = occupationSchema.safeParse(decision.input)
      if (!parsed.success)
        return { ok: false, message: parsed.error.issues[0].message } as const
      occupationId = (await addOccupation(parsed.data, tx)).id
    } else if (decision.kind === "attach") {
      if (!isUuid(decision.occupationId))
        return { ok: false, message: "Choisissez un métier actif." } as const
      const [occupation] = await tx
        .select()
        .from(occupations)
        .where(
          and(
            eq(occupations.id, decision.occupationId),
            eq(occupations.isActive, true),
          ),
        )
      if (!occupation)
        return { ok: false, message: "Choisissez un métier actif." } as const
      occupationId = occupation.id
    }
    if (occupationId) {
      await tx
        .insert(occupationAliases)
        .values({ normalizedLabel, occupationId, createdByUserId: adminId })
        .onConflictDoUpdate({
          target: occupationAliases.normalizedLabel,
          set: { occupationId, createdByUserId: adminId },
        })
      const concerned = await tx
        .select({ offerId: scanCandidates.offerId })
        .from(scanCandidates)
        .where(eq(scanCandidates.occupationReviewId, reviewId))
      const offerIds = concerned.flatMap((candidate) =>
        candidate.offerId ? [candidate.offerId] : [],
      )
      if (offerIds.length)
        await tx
          .update(offers)
          .set({ occupationId })
          .where(and(inArray(offers.id, offerIds), isNull(offers.occupationId)))
      await tx
        .update(scanCandidates)
        .set({
          proposal: sql`jsonb_set(${scanCandidates.proposal}, '{occupationId}', to_jsonb(${occupationId}::text))`,
          version: sql`${scanCandidates.version} + 1`,
        })
        .where(
          and(
            eq(scanCandidates.occupationReviewId, reviewId),
            eq(scanCandidates.status, "to_review"),
          ),
        )
    }
    await tx
      .update(scanCandidates)
      .set({
        issues: sql`coalesce((select jsonb_agg(issue) from jsonb_array_elements(${scanCandidates.issues}) issue where issue->>'code' <> 'occupation_unknown'), '[]'::jsonb)`,
      })
      .where(
        and(
          eq(scanCandidates.occupationReviewId, reviewId),
          eq(scanCandidates.status, "to_review"),
        ),
      )
    await tx
      .update(scanReviews)
      .set({
        status: decision.kind === "reject" ? "dismissed" : "resolved",
        decision: { kind: decision.kind, occupationId },
        decidedAt: new Date(),
        decidedByUserId: adminId,
      })
      .where(eq(scanReviews.id, reviewId))
    return { ok: true } as const
  })
}

export async function listOccupationSuggestions() {
  const reviews = await db
    .select()
    .from(scanReviews)
    .where(
      and(eq(scanReviews.kind, "occupation"), eq(scanReviews.status, "open")),
    )
    .orderBy(scanReviews.createdAt)
    .limit(100)
  const candidates = reviews.length
    ? await db
        .select({
          id: scanCandidates.id,
          title: scanCandidates.title,
          offerId: scanCandidates.offerId,
          reviewId: scanCandidates.occupationReviewId,
        })
        .from(scanCandidates)
        .where(
          inArray(
            scanCandidates.occupationReviewId,
            reviews.map((review) => review.id),
          ),
        )
        .limit(500)
    : []
  return reviews.map((review) => ({
    ...review,
    candidates: candidates.filter(
      (candidate) => candidate.reviewId === review.id,
    ),
  }))
}
