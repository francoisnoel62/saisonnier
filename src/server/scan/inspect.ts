import "server-only"

import { load } from "cheerio"
import { XMLParser } from "fast-xml-parser"

import type { ScanProbeRequest } from "@/domain/scan/probe"
import type { ScanSourceDefinition } from "@/domain/scan/source"

export type ScanDocument = {
  body: string
  finalUrl: string
  contentType: string
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function hasJobPosting(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasJobPosting)
  const object = record(value)
  return (
    object["@type"] === "JobPosting" ||
    (Array.isArray(object["@type"]) &&
      object["@type"].includes("JobPosting")) ||
    (object["@graph"] !== undefined && hasJobPosting(object["@graph"]))
  )
}

// Diagnostic de structure uniquement : aucun champ d'annonce n'est extrait ici.
export function inspectScanDocument(
  { body, finalUrl, contentType }: ScanDocument,
  source: ScanSourceDefinition,
) {
  const xml =
    contentType === "application/rss+xml" ||
    /^(?:application|text)\/xml$/.test(contentType)
  const $ = load(body, { xml })
  let rssItems = 0
  if (xml) {
    try {
      const parsed: unknown = new XMLParser({
        processEntities: false,
        parseTagValue: false,
      }).parse(body)
      const items = record(record(record(parsed).rss).channel).item
      rssItems = Array.isArray(items) ? items.length : items ? 1 : 0
    } catch {
      /* Une structure RSS illisible ne vaut pas un inventaire. */
    }
  }
  let jobPosting: ScanProbeRequest["jobPosting"] = "absent"
  $('script[type="application/ld+json"]').each((_index, element) => {
    const text = $(element).text()
    try {
      if (hasJobPosting(JSON.parse(text))) jobPosting = "valid"
    } catch {
      if (jobPosting !== "valid" && /"@type"\s*:\s*"JobPosting"/.test(text))
        jobPosting = "invalid_json"
    }
  })
  const hrefs: string[] = []
  $("a[href]").each((_index, element) => {
    hrefs.push($(element).attr("href") ?? "")
  })
  if (xml)
    $("item > link").each((_index, element) => {
      hrefs.push($(element).text().trim())
    })
  const pagination =
    $(
      '[rel="next"], a[href*="show_more"], [data-url*="show_more"], a[href*="page=2"], a[href*="afficherplusderesultats/"]',
    ).length > 0
  const pattern = new RegExp(source.postingUrlPattern)
  const links = new Set<string>()
  for (const href of hrefs) {
    try {
      const target = new URL(href, finalUrl)
      target.hash = ""
      if (
        source.officialHosts.includes(target.hostname) &&
        pattern.test(target.href)
      )
        links.add(target.href)
    } catch {
      /* Ignore les liens mal formés. */
    }
  }
  return { jobPosting, rssItems, pagination, links: [...links] }
}
