import {
  findBlockedTargets,
  type BlockedTarget,
} from "@/domain/blocked-domains"
import { isPhoneNumber } from "@/domain/phone"

import { established, absent, type ProposalField } from "./field"
import {
  boundEvidence,
  type Evidence,
  type ExtractedPosting,
  type ObservedContact,
} from "./observation"
import { fold } from "./text"

export type ScanApplication = {
  emails: string[]
  phones: string[]
  formUrl?: string
  generalContacts: ObservedContact[]
}
export function extractApplication(
  posting: Pick<ExtractedPosting, "contacts" | "formUrl">,
): ProposalField<ScanApplication> {
  const emails: string[] = [],
    phones: string[] = [],
    generalContacts: ObservedContact[] = [],
    evidence: Evidence[] = []
  for (const contact of posting.contacts) {
    const applicationSection =
      /\b(?:postuler|candidature|envoyez\s+votre\s+cv)\b/.test(
        fold(contact.section ?? ""),
      )
    const usable =
      contact.kind === "email"
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)
        : isPhoneNumber(contact.value)
    if (contact.official && applicationSection && usable) {
      ;(contact.kind === "email" ? emails : phones).push(contact.value.trim())
    } else
      generalContacts.push({
        ...contact,
        evidence: boundEvidence(contact.evidence),
      })
    evidence.push(boundEvidence(contact.evidence))
  }
  const form = posting.formUrl
  let formUrl: string | undefined
  if (form?.official) {
    try {
      const url = new URL(form.value)
      if (/^https?:$/.test(url.protocol) && !url.username && !url.password)
        formUrl = url.href
    } catch {
      /* URL inexploitable */
    }
    evidence.push(boundEvidence(form.evidence))
  }
  return evidence.length
    ? established(
        {
          emails: [...new Set(emails)],
          phones: [...new Set(phones)],
          ...(formUrl ? { formUrl } : {}),
          generalContacts,
        },
        evidence,
      )
    : absent()
}
export function applicationChannelState(
  application: ScanApplication | undefined,
  blockedDomains: readonly string[],
): {
  state: "direct" | "form_only" | "none" | "blocked"
  blocked: BlockedTarget[]
} {
  if (!application) return { state: "none", blocked: [] }
  const blocked = [
    ...application.emails.flatMap((applyEmail) =>
      findBlockedTargets({ applyEmail }, blockedDomains),
    ),
    ...findBlockedTargets({ applyUrl: application.formUrl }, blockedDomains),
  ]
  if (blocked.length) return { state: "blocked", blocked }
  return {
    state:
      application.emails.length || application.phones.length
        ? "direct"
        : application.formUrl
          ? "form_only"
          : "none",
    blocked,
  }
}
