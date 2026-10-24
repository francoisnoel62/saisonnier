import type { ObservedContact, Evidence } from "@/domain/scan/observation"
import { isPhoneNumber } from "@/domain/phone"
import { fold } from "@/domain/scan/text"

import { evidence } from "./evidence"
import type { TextSection } from "./html"

export function extractContacts(
  sections: TextSection[],
  locator: string,
  kind: Evidence["kind"] = "text",
): ObservedContact[] {
  const contacts: ObservedContact[] = []
  for (const section of sections) {
    const text = section.text
    const inApplicationSection = (index: number) => {
      const line = `${text.slice(0, index).split(/\n/).at(-1) ?? ""}${text.slice(index).split(/\n/)[0]}`
      return /postuler|candidature|envoyez\s+votre\s+cv/.test(
        fold(`${section.heading} ${line}`),
      )
    }
    const role =
      fold(`${section.heading} ${text}`).match(
        /\b(?:accueil|reception|recrutement|rh)\b/,
      )?.[0] ?? "autre"
    for (const match of text.matchAll(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    )) {
      contacts.push({
        kind: "email",
        value: match[0],
        role,
        section: inApplicationSection(match.index) ? "Candidature" : "Autre",
        official: section.scope === "posting",
        evidence: evidence(kind, locator, text, section.scope),
      })
    }
    for (const match of text.matchAll(
      /(?:\+33\s?(?:\(0\)\s?)?|0)[1-9](?:[ .-]?\d{2}){4}\b/g,
    )) {
      if (isPhoneNumber(match[0]))
        contacts.push({
          kind: "phone",
          value: match[0],
          role,
          section: inApplicationSection(match.index) ? "Candidature" : "Autre",
          official: section.scope === "posting",
          evidence: evidence(kind, locator, text, section.scope),
        })
    }
  }
  return contacts.filter(
    (contact, index) =>
      contacts.findIndex(
        (other) =>
          other.kind === contact.kind &&
          other.value === contact.value &&
          other.section === contact.section &&
          other.official === contact.official,
      ) === index,
  )
}
