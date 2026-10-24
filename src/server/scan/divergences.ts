import "server-only"

import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"

import { boundText } from "@/domain/scan/observation"
import type { ScanProposal } from "@/domain/scan/proposal"
import { proposalToOfferInput } from "@/domain/scan/proposal-offer"
import { db } from "@/lib/db"
import { offers, scanReviews, type ScanCandidate } from "@/lib/db/schema"

import type { ScanTransaction } from "./claim"

function fingerprint(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
          )
        : item,
    ) ?? "null"
  )
}
export async function recordDivergence(
  candidate: Pick<ScanCandidate, "id">,
  field: string,
  observed: unknown,
  current: unknown,
  excerpt = "",
  tx: Pick<ScanTransaction, "insert"> = db,
) {
  if (fingerprint(observed) === fingerprint(current)) return
  const hash = createHash("sha256").update(fingerprint(observed)).digest("hex")
  await tx
    .insert(scanReviews)
    .values({
      kind: "divergence",
      candidateId: candidate.id,
      groupKey: `${candidate.id}:${field}:${hash}`,
      details: {
        field,
        current,
        observed,
        excerpt: Array.from(boundText(excerpt)).slice(0, 300).join(""),
      },
    })
    .onConflictDoNothing()
}

export async function recordCandidateDivergences(
  tx: ScanTransaction,
  candidate: ScanCandidate,
  observed: ScanProposal,
) {
  if (
    !candidate.proposal ||
    !["published", "rejected"].includes(candidate.status)
  )
    return
  const previous = candidate.offerId
    ? (
        await tx.select().from(offers).where(eq(offers.id, candidate.offerId))
      )[0]
    : proposalToOfferInput(candidate.proposal)
  if (!previous) return
  const values = proposalToOfferInput(observed)
  for (const field of Object.keys(values) as (keyof typeof values)[]) {
    if (!(field in previous)) continue
    const value = values[field]
    // Une absence ou un inconnu nouvellement observé n'est pas un changement établi.
    if (
      value === null ||
      value === "" ||
      value === "unknown" ||
      (Array.isArray(value) && !value.length)
    )
      continue
    await recordDivergence(
      candidate,
      field,
      value,
      previous[field as keyof typeof previous],
      observed.description.status === "established"
        ? observed.description.value
        : "",
      tx,
    )
  }
}
