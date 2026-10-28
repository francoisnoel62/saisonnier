import "server-only"

import {
  parseAdapterParams,
  type CareerPageParams,
} from "@/domain/scan/adapter-catalog"
import { capturedId } from "@/domain/scan/url-pattern"

import { load } from "../extract/html"
import { jobPostings } from "../extract/jsonld"
import {
  listedPosting,
  listFailure,
  pageLimit,
  postingFailure,
  readDocument,
  type ListedPosting,
  type ScanAdapter,
} from "./adapter"
import { extractHtmlPosting } from "./html-posting"

const version = "career-page@1"

function params(source: { adapter: string; adapterParams: unknown }) {
  const parsed = parseAdapterParams("career-page", source.adapterParams)
  return parsed.success ? (parsed.data as CareerPageParams) : null
}

// Connecteur générique d'un site carrière rendu côté serveur (lot D) : liste HTML (liens),
// plan de site XML (<loc>), RSS ou Atom, selon le type reçu. Seules les URL conformes au
// motif compilé et aux hôtes officiels deviennent des pistes ; la fiche est lue par
// l'extraction HTML commune (JSON-LD, libellés, texte, contacts, lieux).
export const careerPageAdapter: ScanAdapter = {
  kind: "career-page",
  extractorVersion: version,
  async listPage(ctx, cursor) {
    const config = params(ctx.source)
    // Paramètres invalides : la source ne peut pas être lue (configuration à corriger).
    if (!config) return { kind: "blocked", reason: "invalid_url" }
    const page = cursor?.page ?? 0
    if (page >= pageLimit(ctx))
      return { kind: "listed", postings: [], next: null }
    let url = cursor?.url ?? ctx.source.listUrls[0]
    if (config.pagination.kind === "param" && page > 0) {
      const target = new URL(ctx.source.listUrls[0])
      target.searchParams.set(config.pagination.name, String(page + 1))
      url = target.href
    }
    const response = await readDocument(ctx, url)
    if (!response.ok) return listFailure(response)
    const xml = /xml|rss|atom/.test(response.contentType)
    const $ = load(response.body, { xml })
    const candidates: { url: string; title?: string }[] = []
    if (xml) {
      $("url > loc, sitemap > loc").each((_index, node) => {
        candidates.push({ url: $(node).text().trim() })
      })
      $("item").each((_index, node) => {
        candidates.push({
          url: $(node).children("link").first().text().trim(),
          title: $(node).children("title").first().text().trim(),
        })
      })
      $("entry").each((_index, node) => {
        candidates.push({
          url: $(node).children("link").first().attr("href") ?? "",
          title: $(node).children("title").first().text().trim(),
        })
      })
    } else
      $("a[href]").each((_index, node) => {
        candidates.push({
          url: $(node).attr("href") ?? "",
          title: $(node).text().replace(/\s+/g, " ").trim(),
        })
      })
    const postings: ListedPosting[] = []
    for (const candidate of candidates) {
      try {
        const target = new URL(candidate.url, response.finalUrl).href
        const listed = listedPosting(
          ctx,
          target,
          candidate.title ? { title: candidate.title.slice(0, 300) } : {},
          capturedId(ctx.source.postingUrlPattern, target.replace(/\/$/, "")),
        )
        if (
          listed &&
          !postings.some(
            (posting) => posting.identityKey === listed.identityKey,
          )
        )
          postings.push(listed)
      } catch {
        /* Lien inexploitable. */
      }
    }
    let next: { page: number; url?: string } | null = null
    if (postings.length && page + 1 < pageLimit(ctx)) {
      if (config.pagination.kind === "param") next = { page: page + 1 }
      if (config.pagination.kind === "next" && !xml) {
        const href = $('a[rel="next"], link[rel="next"]').first().attr("href")
        if (href) {
          const target = new URL(href, response.finalUrl)
          if (ctx.source.officialHosts.includes(target.hostname))
            next = { page: page + 1, url: target.href }
        }
      }
    }
    return { kind: "listed", postings, next }
  },
  async readPosting(ctx, listed) {
    const config = params(ctx.source)
    const response = await readDocument(ctx, listed.url)
    if (!response.ok) return postingFailure(response)
    try {
      if (config?.requireJsonLd && !jobPostings(load(response.body)).length)
        return { kind: "unreadable", reason: "invalid_document" }
      return await extractHtmlPosting(ctx, listed, response.body, version)
    } catch {
      return { kind: "unreadable", reason: "invalid_document" }
    }
  },
}
