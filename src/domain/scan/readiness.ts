import { findBlockedTargets } from "@/domain/blocked-domains"

import { postingClosed } from "./activity"
import { applicationChannelState } from "./application"
import { valueOf } from "./field"
import { isFrance } from "./locale"
import { completePeriod, isPeriod } from "./period"
import { proposalIssues, type ScanProposal } from "./proposal"
import {
  scanIssue,
  uniqueIssues,
  type ScanIssue,
  type ScanMode,
} from "./vocabulary"

export type Readiness = { blocking: ScanIssue[]; alerts: ScanIssue[] }
export type ReadinessContext = {
  officialHosts: readonly string[]
  blockedDomains: readonly string[]
  today: string
  now: string
  potentialDuplicate?: boolean
  reusedIdentity?: boolean
  occupationKnown?: boolean
}
export function isOfficialUrl(
  value: string | undefined,
  officialHosts: readonly string[],
) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      officialHosts.some(
        (host) =>
          host.toLowerCase().replace(/\.$/, "") ===
          url.hostname.toLowerCase().replace(/\.$/, ""),
      )
    )
  } catch {
    return false
  }
}
export function publicationReadiness(
  proposal: ScanProposal,
  context: ReadinessContext,
): Readiness {
  const issues = proposalIssues(proposal)
  const company = valueOf(proposal.company)
  if (!company?.name.trim()) issues.push(scanIssue("company"))
  const period = valueOf(proposal.period)
  if (!period || !isPeriod(period) || !completePeriod(period))
    issues.push(scanIssue("period"))
  const officialUrl = valueOf(proposal.officialUrl)
  if (!isOfficialUrl(officialUrl, context.officialHosts))
    issues.push(scanIssue("official_source"))
  if (
    findBlockedTargets({ sourceUrl: officialUrl }, context.blockedDomains)
      .length
  )
    issues.push(scanIssue("blocked_domain"))
  const application = valueOf(proposal.application)
  const channel = applicationChannelState(application, context.blockedDomains)
  if (channel.state === "none") issues.push(scanIssue("application"))
  if (channel.state === "blocked") issues.push(scanIssue("blocked_domain"))
  if (channel.state === "form_only") issues.push(scanIssue("form_only"))
  if (channel.state === "none" && application?.generalContacts.length)
    issues.push(scanIssue("general_contact_only"))
  if (postingClosed(proposal, context)) issues.push(scanIssue("activity"))
  if (valueOf(proposal.locations)?.some((place) => isFrance(place) === false))
    issues.push(scanIssue("location"))
  if (context.potentialDuplicate) issues.push(scanIssue("duplicate"))
  if (context.reusedIdentity) issues.push(scanIssue("reused_identity"))
  if (context.occupationKnown === false)
    issues.push(scanIssue("occupation_unknown"))
  const unique = uniqueIssues(issues)
  return {
    blocking: unique.filter((issue) => issue.blocking),
    alerts: unique.filter((issue) => !issue.blocking),
  }
}
export function canAutoPublish({
  mode,
  sourceAutoPublish,
  readiness,
}: {
  mode: ScanMode
  sourceAutoPublish: boolean
  readiness: Readiness
}) {
  return (
    mode === "daily" && sourceAutoPublish && readiness.blocking.length === 0
  )
}
