import {
  adminOfferToFormValues,
  emptyAdminOfferFormValues,
  type AdminOfferFormValues,
} from "@/domain/offer-input"

import { valueOf } from "./field"
import type { ScanProposal } from "./proposal"
import {
  conditionPrecisionLimit,
  proposalTextLimits,
  proposalToOfferInput,
  type ProposalTextField,
} from "./proposal-offer"
import { scanIssue } from "./vocabulary"

export function proposalFormIssues(proposal: ScanProposal) {
  const fields = Object.keys(proposalTextLimits) as ProposalTextField[]
  const texts = fields.flatMap((field) => {
    const value = valueOf(proposal[field])
    return value && value.length > proposalTextLimits[field]
      ? [scanIssue("text_truncated", field)]
      : []
  })
  const precisions = (
    ["housing", "meals", "drivingLicenceRequired"] as const
  ).flatMap((condition) =>
    (proposal.conditionPrecisions[condition]?.length ?? 0) >
    conditionPrecisionLimit
      ? [scanIssue("text_truncated", condition)]
      : [],
  )
  return [...texts, ...precisions]
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
