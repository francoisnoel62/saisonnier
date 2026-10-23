import "server-only"

import { promises as dns, type LookupAddress } from "node:dns"
import { request as httpRequest, type IncomingHttpHeaders } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib"
import robotsParser from "robots-parser"

import { site } from "@/config/site"
import type {
  RobotsDecision,
  ScanFailure,
  ScanFetchResult,
} from "@/domain/scan/http"
import { scanLimits } from "@/domain/scan/limits"
import {
  checkScanUrl,
  isTestSourceUrl,
  type ScanUrlPolicy,
} from "@/domain/scan/url-safety"
import { env } from "@/lib/env"

import { isPublicAddress } from "./address-guard"
import { abortable, HostPacer, scanHostPacer } from "./host-pacer"

const allowedTypes = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/json",
  "application/ld+json",
  "application/rss+xml",
  "application/xml",
  "text/xml",
])
const redirectStatuses = new Set([301, 302, 303, 307, 308])
type RawResponse = {
  ok: true
  status: number
  headers: IncomingHttpHeaders
  contentType: string
  body: string
  bytes: number
}
type Robots = {
  parser: ReturnType<typeof robotsParser>
  status: number
  crawlDelayMs: number
}

export type ScanHttpOptions = {
  policy?: ScanUrlPolicy
  timeoutMs?: number
  maxBytes?: number
  minIntervalMs?: number
  pacer?: HostPacer
  // La résolution est injectable ; toutes ses réponses restent soumises à la garde d'adresse.
  resolve?: (hostname: string) => Promise<LookupAddress[]>
}

export function retryAfterMs(value: string | undefined, now = Date.now()) {
  if (!value) return undefined
  if (/^\d+$/.test(value.trim()))
    return Math.min(Number(value) * 1_000, Number.MAX_SAFE_INTEGER)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined
}

function failureForStatus(
  status: number,
  headers: IncomingHttpHeaders,
): ScanFailure {
  const retry = retryAfterMs(headers["retry-after"])
  const reason =
    status === 429 || (status === 503 && retry !== undefined)
      ? "rate_limited"
      : status === 401 || status === 403
        ? "access_denied"
        : status === 404
          ? "not_found"
          : status === 410
            ? "gone"
            : "http_error"
  return {
    ok: false,
    reason,
    status,
    ...(retry !== undefined ? { retryAfterMs: retry } : {}),
  }
}

// Une instance par étape : robots.txt n'est conservé que pendant cette étape.
export function createScanHttpClient(options: ScanHttpOptions = {}) {
  const policy = options.policy ?? {
    environment: env.NODE_ENV,
    testSourceUrl: env.SCAN_TEST_SOURCE_URL,
  }
  const pacer = options.pacer ?? scanHostPacer
  const intervalMs = Math.max(
    0,
    options.minIntervalMs ?? scanLimits.minIntervalMs,
  )
  const timeoutMs = Math.min(
    options.timeoutMs ?? scanLimits.timeoutMs,
    scanLimits.timeoutMs,
  )
  const maxBytes = Math.min(
    options.maxBytes ?? scanLimits.maxBytes,
    scanLimits.maxBytes,
  )
  const resolve =
    options.resolve ??
    ((hostname: string) => dns.lookup(hostname, { all: true }))
  const userAgent = `${site.name}Bot/1.0 (+${env.BETTER_AUTH_URL.replace(/\/$/, "")}/contact)`
  const robotsCache = new Map<string, Promise<Robots | ScanFailure>>()

  async function raw(
    url: URL,
    signal: AbortSignal,
    crawlDelayMs: number,
    robots = false,
  ): Promise<RawResponse | ScanFailure> {
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    const local = isTestSourceUrl(url, policy)
    const addresses = local
      ? [{ address: "127.0.0.1", family: 4 }]
      : isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await abortable(resolve(hostname), signal)
    if (
      !addresses.length ||
      (!local && addresses.some(({ address }) => !isPublicAddress(address)))
    ) {
      return { ok: false, reason: "blocked_address" }
    }
    const address = addresses[0]
    // Le nom reste dans Host et SNI ; la socket utilise uniquement l'adresse contrôlée.
    const lookup: LookupFunction = (_hostname, _options, callback) => {
      if (_options.all) callback(null, [address])
      else callback(null, address.address, address.family)
    }
    return pacer.run(
      hostname,
      Math.max(intervalMs, crawlDelayMs),
      signal,
      () =>
        new Promise((resolveResponse, reject) => {
          const request = (local ? httpRequest : httpsRequest)(
            url,
            {
              agent: false,
              lookup,
              signal,
              headers: {
                "User-Agent": userAgent,
                "Accept-Language": "fr-FR,fr;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
              },
            },
            (response) => {
              const status = response.statusCode ?? 0
              const headers = response.headers
              const contentType = (headers["content-type"] ?? "")
                .split(";")[0]
                .trim()
                .toLowerCase()
              const retry = retryAfterMs(headers["retry-after"])
              if (retry !== undefined && (status === 429 || status === 503))
                pacer.defer(hostname, retry)
              if (
                redirectStatuses.has(status) ||
                status < 200 ||
                status >= 300
              ) {
                response.destroy()
                resolveResponse({
                  ok: true,
                  status,
                  headers,
                  contentType,
                  body: "",
                  bytes: 0,
                })
                return
              }
              if (
                !(robots
                  ? contentType === "text/plain" ||
                    allowedTypes.has(contentType)
                  : allowedTypes.has(contentType))
              ) {
                response.destroy()
                resolveResponse({
                  ok: false,
                  reason: "unsupported_type",
                  status,
                })
                return
              }
              const encoding = (headers["content-encoding"] ?? "identity")
                .toLowerCase()
                .trim()
              const decoder =
                encoding === "gzip"
                  ? createGunzip()
                  : encoding === "deflate"
                    ? createInflate()
                    : encoding === "br"
                      ? createBrotliDecompress()
                      : null
              if (!decoder && encoding !== "identity") {
                response.destroy()
                resolveResponse({
                  ok: false,
                  reason: "unsupported_type",
                  status,
                })
                return
              }
              let bytes = 0
              let tooLarge = false
              const chunks: Buffer[] = []
              const sink = new Writable({
                write(chunk: Buffer, _encoding, done) {
                  bytes += chunk.length
                  if (bytes > maxBytes) {
                    tooLarge = true
                    done(new Error("too_large"))
                    return
                  }
                  chunks.push(chunk)
                  done()
                },
              })
              const reading = decoder
                ? pipeline(response, decoder, sink, { signal })
                : pipeline(response, sink, { signal })
              reading.then(
                () =>
                  resolveResponse({
                    ok: true,
                    status,
                    headers,
                    contentType,
                    body: Buffer.concat(chunks).toString("utf8"),
                    bytes,
                  }),
                (error) =>
                  tooLarge
                    ? resolveResponse({
                        ok: false,
                        reason: "too_large",
                        status,
                      })
                    : reject(error),
              )
            },
          )
          request.on("error", reject)
          request.end()
        }),
    )
  }

  async function getRobots(
    url: URL,
    signal: AbortSignal,
    ancestors = new Set<string>(),
  ): Promise<Robots | ScanFailure> {
    if (ancestors.has(url.origin))
      return { ok: false, reason: "too_many_redirects" }
    const cached = robotsCache.get(url.origin)
    if (cached) return abortable(cached, signal)
    const pending = readRobots(url, signal, new Set([...ancestors, url.origin]))
    robotsCache.set(url.origin, pending)
    return abortable(pending, signal)
  }

  async function readRobots(
    url: URL,
    signal: AbortSignal,
    ancestors: Set<string>,
  ): Promise<Robots | ScanFailure> {
    const original = new URL("/robots.txt", url)
    let current = original
    try {
      for (let redirects = 0; ; redirects++) {
        const checked = checkScanUrl(current.href, policy)
        if (!checked) return { ok: false, reason: "invalid_url" }
        let delay = 0
        if (current.origin !== original.origin) {
          const targetRules = await getRobots(current, signal, ancestors)
          if ("ok" in targetRules) return targetRules
          if (targetRules.parser.isAllowed(current.href, userAgent) === false)
            return { ok: false, reason: "robots_disallowed" }
          delay = targetRules.crawlDelayMs
        }
        const result = await raw(checked, signal, delay, true)
        if (!result.ok) return result
        if (redirectStatuses.has(result.status)) {
          if (redirects >= scanLimits.maxRedirects)
            return {
              ok: false,
              reason: "too_many_redirects",
              status: result.status,
            }
          if (!result.headers.location)
            return { ok: false, reason: "http_error", status: result.status }
          try {
            current = new URL(result.headers.location, current)
          } catch {
            return { ok: false, reason: "invalid_url" }
          }
          continue
        }
        if (
          result.status !== 404 &&
          (result.status < 200 || result.status >= 300)
        )
          return failureForStatus(result.status, result.headers)
        const parser = robotsParser(
          original.href,
          result.status === 404 ? "" : result.body,
        )
        const seconds = parser.getCrawlDelay(userAgent)
        return {
          parser,
          status: result.status,
          crawlDelayMs:
            seconds && Number.isFinite(seconds) && seconds > 0
              ? Math.min(seconds * 1_000, Number.MAX_SAFE_INTEGER)
              : 0,
        }
      }
    } catch {
      return { ok: false, reason: signal.aborted ? "timeout" : "network" }
    }
  }

  async function scanFetch(value: string): Promise<ScanFetchResult> {
    const started = Date.now()
    const signal = AbortSignal.timeout(timeoutMs)
    const robots: RobotsDecision[] = []
    try {
      let current = value
      for (let redirects = 0; ; redirects++) {
        const url = checkScanUrl(current, policy)
        if (!url) return { ok: false, reason: "invalid_url", robots }
        const rules = await getRobots(url, signal)
        if ("ok" in rules) {
          robots.push({
            url: new URL("/robots.txt", url).href,
            status: rules.status,
            allowed: false,
            crawlDelayMs: 0,
          })
          return { ...rules, robots }
        }
        const allowed = rules.parser.isAllowed(url.href, userAgent) !== false
        robots.push({
          url: new URL("/robots.txt", url).href,
          status: rules.status,
          allowed,
          crawlDelayMs: rules.crawlDelayMs,
        })
        if (!allowed) return { ok: false, reason: "robots_disallowed", robots }
        const response = await raw(url, signal, rules.crawlDelayMs)
        if (!response.ok) return { ...response, robots }
        if (redirectStatuses.has(response.status)) {
          if (redirects >= scanLimits.maxRedirects)
            return {
              ok: false,
              reason: "too_many_redirects",
              status: response.status,
              robots,
            }
          if (!response.headers.location)
            return {
              ok: false,
              reason: "http_error",
              status: response.status,
              robots,
            }
          try {
            current = new URL(response.headers.location, url).href
          } catch {
            return { ok: false, reason: "invalid_url", robots }
          }
          continue
        }
        if (response.status < 200 || response.status >= 300)
          return {
            ...failureForStatus(response.status, response.headers),
            robots,
          }
        return {
          ok: true,
          status: response.status,
          finalUrl: url.href,
          contentType: response.contentType,
          body: response.body,
          bytes: response.bytes,
          elapsedMs: Date.now() - started,
          fetchedAt: new Date().toISOString(),
          robots,
        }
      }
    } catch {
      return {
        ok: false,
        reason: signal.aborted ? "timeout" : "network",
        robots,
      }
    }
  }
  return { scanFetch }
}

export function scanFetch(url: string, options?: ScanHttpOptions) {
  return createScanHttpClient(options).scanFetch(url)
}
