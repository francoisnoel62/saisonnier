import {
  adminOfferToFormValues,
  emptyAdminOfferFormValues,
  type AdminOfferFormValues,
} from "@/domain/offer-input"

import { valueOf } from "./field"
import type { ScanProposal } from "./proposal"
import { proposalToOfferInput } from "./proposal-offer"
import { scanIssue } from "./vocabulary"

export function proposalFormIssues(proposal: ScanProposal) {
  return (["title", "description", "missions"] as const).flatMap((field) => {
    const value = valueOf(proposal[field])
    const limit = { title: 150, description: 5000, missions: 3000 }[field]
    return value && value.length > limit
      ? [scanIssue("text_truncated", field)]
      : []
  })
}

export function proposalToAdminFormValues(
  proposal: ScanProposal,
  {
    companyId,
    sourceName = "",
  }: { companyId: string | null; sourceName?: string },
): AdminOfferFormValues {
  const input = proposalToOfferInput(proposal)
  const values = adminOfferToFormValues({
    ...input,
    season: input.season,
    origin: "collected",
    companyId: companyId ?? "",
    sourceName,
    applicationChannel: "employer",
    recruiterName: null,
    hideCompanyIdentity: false,
  })
  return {
    ...emptyAdminOfferFormValues(),
    ...values,
    occupationId: proposal.occupationId ?? "",
    season: input.season ?? "",
    seasonalContract: valueOf(proposal.contract) === "seasonal",
    periodKind:
      input.startDate && input.endDate
        ? "dates"
        : input.durationValue
          ? "duration"
          : "dates",
    durationValue: input.durationValue ? String(input.durationValue) : "",
    durationUnit: input.durationUnit ?? "",
  }
}
