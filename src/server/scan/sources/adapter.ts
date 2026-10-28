import "server-only"

import { createHash } from "node:crypto"

import type { ScanFetchResult, ScanFailureReason } from "@/domain/scan/http"
import { recruitmentIdentity, canonicalUrl } from "@/domain/scan/identity"
import { scanLimits } from "@/domain/scan/limits"
import type { ExtractedPosting } from "@/domain/scan/observation"
import type { ScanSourceDefinition } from "@/domain/scan/source"
import { createScanHttpClient, type ScanFetchOptions } from "../http"

export type AdapterKind = ScanSourceDefinition["adapter"]
// `list` : index de la liste lue (recherches France Travail multiples) ; `url` : page suivante
// annoncée par la page lue (pagination rel="next").
export type ListCursor = {
  page: number
  format?: "rss" | "html"
  list?: number
  url?: string
}
export type ListedPosting = {
  url: string
  identityKey: string
  externalId?: string
  title?: string
  sourceDate?: string
  data: Record<string, unknown>
  listingHash: string
  index?: number
}
export type SourceFailure = {
  kind: "blocked" | "rate_limited" | "unavailable"
  reason: ScanFailureReason
  retryAfterMs?: number
}
export type ListPageResult =
  | { kind: "listed"; postings: ListedPosting[]; next: ListCursor | null }
  | SourceFailure
export type ReadResult =
  | {
      kind: "extracted"
      posting: ExtractedPosting
      postings?: ExtractedPosting[]
    }
  | { kind: "gone" }
  | {
      kind: "unreadable"
      reason: ScanFailureReason | "invalid_document"
      // Retry-After d'un hôte à ménager (429, 503) : l'étape attend ce délai.
      retryAfterMs?: number
    }
export type AdapterContext = {
  source: ScanSourceDefinition
  now: string
  deadline: number
  scanFetch: (
    url: string,
    options?: ScanFetchOptions,
  ) => Promise<ScanFetchResult>
  log: (event: string, details?: Record<string, unknown>) => void
  departmentCodes: readonly string[]
}
export type ScanAdapter = {
  kind: AdapterKind
  extractorVersion: string
  listPage: (
    ctx: AdapterContext,
    cursor: ListCursor | null,
  ) => Promise<ListPageResult>
  readPosting: (
    ctx: AdapterContext,
    listed: ListedPosting,
  ) => Promise<ReadResult>
}
export function createAdapterContext(
  source: ScanSourceDefinition,
  options: {
    departmentCodes: readonly string[]
    now?: Date
    deadline?: number
    log?: AdapterContext["log"]
  },
): AdapterContext {
  const client = createScanHttpClient(source.limits)
  return {
    source,
    now: (options.now ?? new Date()).toISOString(),
    deadline: options.deadline ?? Date.now() + scanLimits.batchBudgetMs,
    scanFetch: client.scanFetch,
    log: options.log ?? (() => {}),
    departmentCodes: options.departmentCodes,
  }
}
export function listingHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}
export function listedPosting(
  ctx: AdapterContext,
  url: string,
  data: Record<string, unknown>,
  externalId?: string,
): ListedPosting | null {
  const canonical = canonicalUrl(url)
  if (
    !canonical ||
    !ctx.source.officialHosts.includes(new URL(canonical).hostname) ||
    !new RegExp(ctx.source.postingUrlPattern).test(canonical)
  )
    return null
  return {
    url: canonical,
    externalId,
    identityKey: recruitmentIdentity({
      adapter: ctx.source.adapter,
      host: new URL(canonical).hostname,
      externalId,
      url: canonical,
    }),
    data,
    title: typeof data.title === "string" ? data.title : undefined,
    sourceDate:
      typeof data.sourceDate === "string" ? data.sourceDate : undefined,
    listingHash: listingHash(data),
  }
}
export async function readDocument(
  ctx: AdapterContext,
  url: string,
): Promise<ScanFetchResult> {
  try {
    const target = new URL(url)
    if (
      !ctx.source.officialHosts.includes(target.hostname) ||
      target.username ||
      target.password ||
      (target.protocol !== "https:" &&
        !(
          (ctx.source.adapter === "fixture" ||
            ctx.source.adapter === "career-page") &&
          target.protocol === "http:"
        ))
    )
      return {
        ok: false,
        reason: "invalid_url",
        robots: [],
        elapsedMs: 0,
        waitedMs: 0,
      }
  } catch {
    return {
      ok: false,
      reason: "invalid_url",
      robots: [],
      elapsedMs: 0,
      waitedMs: 0,
    }
  }
  try {
    return await ctx.scanFetch(url, { deadline: ctx.deadline })
  } catch {
    return {
      ok: false,
      reason: "network",
      robots: [],
      elapsedMs: 0,
      waitedMs: 0,
    }
  }
}
export function listFailure(
  result: Extract<ScanFetchResult, { ok: false }>,
): SourceFailure {
  return {
    kind:
      result.reason === "rate_limited"
        ? "rate_limited"
        : [
              "robots_disallowed",
              "access_denied",
              "blocked_address",
              "invalid_url",
            ].includes(result.reason)
          ? "blocked"
          : "unavailable",
    reason: result.reason,
    retryAfterMs: result.retryAfterMs,
  }
}
export function postingFailure(
  result: Extract<ScanFetchResult, { ok: false }>,
): ReadResult {
  return result.status === 404 || result.status === 410
    ? { kind: "gone" }
    : {
        kind: "unreadable",
        reason: result.reason,
        ...(result.retryAfterMs !== undefined
          ? { retryAfterMs: result.retryAfterMs }
          : {}),
      }
}
export function pageLimit(ctx: AdapterContext) {
  return Math.min(
    ctx.source.limits.maxListPages ?? scanLimits.maxListPages,
    scanLimits.maxListPages,
  )
}
