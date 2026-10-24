import { env } from "@/lib/env"

import { load } from "../extract/html"
import {
  listedPosting,
  readDocument,
  listFailure,
  postingFailure,
  type ListedPosting,
  type ScanAdapter,
} from "./adapter"
import { extractHtmlPosting } from "./html-posting"

export function fixtureAdapter(): ScanAdapter | null {
  if (!env.SCAN_TEST_SOURCE_URL) return null
  return {
    kind: "fixture",
    extractorVersion: "fixture@1",
    async listPage(ctx, cursor) {
      if (cursor) return { kind: "listed", postings: [], next: null }
      const response = await readDocument(ctx, ctx.source.listUrls[0])
      if (!response.ok) return listFailure(response)
      const $ = load(response.body),
        postings: ListedPosting[] = []
      $("a[href]").each((_i, node) => {
        try {
          const url = new URL($(node).attr("href")!, response.finalUrl).href
          const listed = listedPosting(
            ctx,
            url,
            { title: $(node).text().trim() },
            /\/jobs\/(\d+)/.exec(url)?.[1],
          )
          if (listed) postings.push(listed)
        } catch {
          /* Lien non exploitable. */
        }
      })
      return { kind: "listed", postings, next: null }
    },
    async readPosting(ctx, listed) {
      const response = await readDocument(ctx, listed.url)
      if (!response.ok) return postingFailure(response)
      try {
        return await extractHtmlPosting(ctx, listed, response.body, "fixture@1")
      } catch {
        return { kind: "unreadable", reason: "invalid_document" }
      }
    },
  }
}
