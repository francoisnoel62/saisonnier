import "server-only"

import { load } from "cheerio"
import { XMLParser } from "fast-xml-parser"

import type { DetectionSignals } from "@/domain/scan/detection"
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

// Signaux de détection (§8.2) d'une page de départ ou d'un flux : liens, flux annoncés,
// générateur, hôtes des scripts et styles, marqueurs d'application JavaScript, JSON-LD.
// Seuls ces signaux sont gardés, jamais le contenu de la page.
export function detectionSignals({
  body,
  finalUrl,
  contentType,
}: ScanDocument): DetectionSignals {
  const xml =
    contentType === "application/rss+xml" ||
    contentType === "application/atom+xml" ||
    /^(?:application|text)\/xml$/.test(contentType)
  const $ = load(body, { xml })
  const absolute = (value: string | undefined) => {
    try {
      return value ? new URL(value, finalUrl).href : null
    } catch {
      return null
    }
  }
  const feedLinks = $('link[rel="alternate"]')
    .filter((_index, element) =>
      /rss|atom/i.test($(element).attr("type") ?? ""),
    )
    .map((_index, element) => absolute($(element).attr("href")))
    .get()
    .filter((value): value is string => !!value)
  const assetHosts = new Set<string>()
  $('script[src], link[rel="stylesheet"][href]').each((_index, element) => {
    const url = absolute($(element).attr("src") ?? $(element).attr("href"))
    if (url && assetHosts.size < 20) assetHosts.add(new URL(url).hostname)
  })
  const markers: string[] = []
  for (const selector of ["#root", "#__next", "#app", "app-root"]) {
    const node = $(selector)
    if (node.length && !node.text().trim()) markers.push(selector)
  }
  if (/javascript/i.test($("noscript").text())) markers.push("noscript")
  const links = new Set<string>()
  $("a[href]").each((_index, element) => {
    const url = absolute($(element).attr("href"))
    if (url && links.size < 500) links.add(url.split("#")[0])
  })
  if (xml)
    $("item > link, entry > link").each((_index, element) => {
      const url = absolute($(element).text().trim() || $(element).attr("href"))
      if (url && links.size < 500) links.add(url)
    })
  const namespaces = xml
    ? [...body.slice(0, 2000).matchAll(/xmlns:([a-z0-9]+)=/gi)].map((match) =>
        match[1].toLowerCase(),
      )
    : []
  const inspection = xml
    ? null
    : (() => {
        let jobPosting: DetectionSignals["jobPosting"] = "absent"
        $('script[type="application/ld+json"]').each((_index, element) => {
          const text = $(element).text()
          try {
            if (hasJobPosting(JSON.parse(text))) jobPosting = "valid"
          } catch {
            if (
              jobPosting !== "valid" &&
              /"@type"\s*:\s*"JobPosting"/.test(text)
            )
              jobPosting = "invalid_json"
          }
        })
        return jobPosting
      })()
  $("script, style, noscript").remove()
  return {
    finalUrl,
    contentType,
    feedLinks,
    generator:
      $('meta[name="generator"]').attr("content")?.slice(0, 100) ?? null,
    assetHosts: [...assetHosts],
    scriptCount: load(body, { xml })("script").length,
    javascriptMarkers: markers,
    jobPosting: inspection ?? "absent",
    links: [...links],
    textLength: xml ? 0 : $("body").text().replace(/\s+/g, " ").trim().length,
    rssItems: xml ? $("item, entry").length : 0,
    rssNamespaces: namespaces,
  }
}
