import { load, plainText } from "../extract/html"
import {
  listedPosting,
  readDocument,
  listFailure,
  postingFailure,
  type ListPageResult,
  type ScanAdapter,
} from "./adapter"
import { extractHtmlPosting } from "./html-posting"

export const factorialAdapter: ScanAdapter = {
  kind: "factorial",
  extractorVersion: "factorial@1",
  async listPage(ctx, cursor) {
    if (cursor) return { kind: "listed", postings: [], next: null }
    const result = await readDocument(ctx, ctx.source.listUrls[0])
    if (!result.ok) return listFailure(result)
    const $ = load(result.body)
    const postings: Extract<ListPageResult, { kind: "listed" }>["postings"] = []
    let place = ""
    $("h2,h3,a[href]").each((_i, node) => {
      if (node.tagName !== "a") {
        place = $(node).text().trim()
        return
      }
      try {
        const target = new URL($(node).attr("href")!, result.finalUrl)
        const id = /\/job_posting\/[^/]+-(\d+)$/.exec(target.pathname)?.[1]
        if (!id) return
        const parent = $(node).closest("li")
        const title =
          plainText(
            (parent.length ? parent : $(node))
              .clone()
              .children("a")
              .remove()
              .end()
              .text()
              .trim(),
          ) || plainText($(node).text())
        const listed = listedPosting(ctx, target.href, { title, place }, id)
        if (
          listed &&
          !postings.some(
            (posting) => posting.identityKey === listed.identityKey,
          )
        )
          postings.push(listed)
      } catch {
        /* Ne suivre ni /apply ni les liens externes. */
      }
    })
    return {
      kind: "listed",
      postings: postings.slice(0, ctx.source.limits.maxPostings ?? 400),
      next: null,
    }
  },
  async readPosting(ctx, listed) {
    const result = await readDocument(ctx, listed.url)
    if (!result.ok) return postingFailure(result)
    try {
      return await extractHtmlPosting(ctx, listed, result.body, "factorial@1")
    } catch {
      return { kind: "unreadable", reason: "invalid_document" }
    }
  },
}
