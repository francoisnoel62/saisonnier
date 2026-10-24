import { XMLParser, XMLValidator } from "fast-xml-parser"

import type { AdapterContext, ListedPosting } from "../sources/adapter"
import { listedPosting } from "../sources/adapter"
import { plainText } from "./html"

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
export function many(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value]
}
export function rssPostings(
  xml: string,
  ctx: AdapterContext,
): ListedPosting[] | null {
  if (XMLValidator.validate(xml) !== true) return null
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: false,
    parseTagValue: false,
    processEntities: true,
  }).parse(xml)
  const channel = record(record(record(parsed).rss).channel)
  if (!Object.keys(channel).length) return null
  const postings: ListedPosting[] = []
  for (const value of many(channel.item)) {
    const item = record(value)
    if (typeof item.link !== "string") continue
    const id = /\/jobs\/(\d+)/.exec(item.link)?.[1]
    const locations = many(record(item["tt:locations"])["tt:location"]).map(
      (value) =>
        Object.fromEntries(
          Object.entries(record(value)).map(([key, value]) => [
            key,
            typeof value === "string" ? plainText(value) : value,
          ]),
        ),
    )
    const listed = listedPosting(
      ctx,
      item.link,
      {
        title: plainText(String(item.title ?? "")),
        sourceDate: String(item.pubDate ?? ""),
        description: plainText(String(item.description ?? "")),
        guid: record(item.guid)["#text"] ?? item.guid,
        locations,
        department: plainText(String(item["tt:department"] ?? "")),
        role: plainText(String(item["tt:role"] ?? "")),
      },
      id,
    )
    if (
      listed &&
      !postings.some((posting) => posting.identityKey === listed.identityKey)
    )
      postings.push(listed)
  }
  return postings
}
