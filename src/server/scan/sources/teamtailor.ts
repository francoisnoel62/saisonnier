import { load } from "../extract/html"
import { rssPostings } from "../extract/rss"

import {
  listedPosting,
  readDocument,
  listFailure,
  postingFailure,
  pageLimit,
  type AdapterContext,
  type ListCursor,
  type ListPageResult,
  type ScanAdapter,
} from "./adapter"
import { extractHtmlPosting } from "./html-posting"

export async function htmlListPage(
  ctx: AdapterContext,
  cursor: ListCursor | null,
): Promise<ListPageResult> {
  const page = cursor?.page ?? 0
  if (page >= pageLimit(ctx))
    return { kind: "listed", postings: [], next: null }
  const url = new URL(ctx.source.listUrls[0])
  url.pathname = page ? "/jobs/show_more" : "/jobs"
  url.search = page ? `?page=${page + 1}` : ""
  const result = await readDocument(ctx, url.href)
  if (!result.ok) return listFailure(result)
  const $ = load(result.body)
  const postings: Extract<ListPageResult, { kind: "listed" }>["postings"] = []
  $("a[href]").each((_i, node) => {
    try {
      const target = new URL($(node).attr("href")!, result.finalUrl).href
      const id = /\/jobs\/(\d+)/.exec(target)?.[1]
      const listed = listedPosting(
        ctx,
        target,
        { title: $(node).text().trim() },
        id,
      )
      if (
        listed &&
        !postings.some((posting) => posting.identityKey === listed.identityKey)
      )
        postings.push(listed)
    } catch {
      /* Lien non exploitable. */
    }
  })
  return {
    kind: "listed",
    postings,
    next:
      postings.length && page + 1 < pageLimit(ctx)
        ? { page: page + 1, format: "html" }
        : null,
  }
}
export const teamtailorAdapter: ScanAdapter = {
  kind: "teamtailor",
  extractorVersion: "teamtailor@1",
  async listPage(ctx, cursor) {
    if (cursor?.format === "html") return htmlListPage(ctx, cursor)
    const url = new URL("/jobs.rss", ctx.source.listUrls[0]).href
    const result = await readDocument(ctx, url)
    if (!result.ok)
      return [404, 410].includes(result.status ?? 0)
        ? htmlListPage(ctx, null)
        : listFailure(result)
    const postings = rssPostings(result.body, ctx)
    return postings === null
      ? htmlListPage(ctx, null)
      : {
          kind: "listed",
          postings: postings.slice(0, ctx.source.limits.maxPostings ?? 400),
          next: null,
        }
  },
  async readPosting(ctx, listed) {
    const result = await readDocument(ctx, listed.url)
    if (!result.ok) return postingFailure(result)
    try {
      return await extractHtmlPosting(ctx, listed, result.body, "teamtailor@1")
    } catch {
      return { kind: "unreadable", reason: "invalid_document" }
    }
  },
}
