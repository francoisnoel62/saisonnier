import "server-only"

import { createHash } from "node:crypto"
import { promises as dns, type LookupAddress } from "node:dns"
import { request as httpRequest, type IncomingHttpHeaders } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib"
import robotsParser from "robots-parser"

import { site } from "@/config/site"
import { scanUserAgent } from "@/domain/scan/authorization-request"
import { declaredCharset, decodeBody } from "@/domain/scan/charset"
import type {
  RobotsDecision,
  ScanFailure,
  ScanFetchOutcome,
  ScanFetchResult,
} from "@/domain/scan/http"
import { scanLimits } from "@/domain/scan/limits"
import type { ScanRequestLimits } from "@/domain/scan/source"
import {
  checkScanUrl,
  isTestSourceUrl,
  type ScanUrlPolicy,
} from "@/domain/scan/url-safety"
import { env } from "@/lib/env"

import { isPublicAddress } from "./address-guard"
import {
  abortable,
  HostDeferral,
  HostPacer,
  type PacerTurn,
  scanHostPacer,
} from "./host-pacer"

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

// Réponse reçue de l'hôte, quel que soit son statut : l'appelant en décide.
type Exchange = {
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
  digest: string
}
// Une lecture et ses redirections : échéance commune et durées cumulées.
type Reading = PacerTurn & {
  elapsedMs: number
  waitedMs: number
  // Resserre la durée d'un échange (attente de politesse exclue), jamais au-delà de `timeoutMs`.
  exchangeTimeoutMs?: number
}
type Purpose = "robots" | "page"

export type ScanHttpOptions = ScanRequestLimits & {
  policy?: ScanUrlPolicy
  pacer?: HostPacer
  // La résolution est injectable ; toutes ses réponses restent soumises à la garde d'adresse.
  resolve?: (hostname: string) => Promise<LookupAddress[]>
}
export type ScanFetchOptions = {
  // Échéance de l'étape (horodatage) ; par défaut, le budget d'une étape de lot.
  deadline?: number
  signal?: AbortSignal
  // Durée maximale de chaque échange, comptée depuis l'envoi ; elle ne peut que raccourcir celle du client.
  exchangeTimeoutMs?: number
}

function isFailure(value: object): value is ScanFailure {
  return "reason" in value
}

function isAbort(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
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
  if (env.NODE_ENV === "production" && policy.environment !== "production")
    throw new Error("Politique de test interdite en preview et en production.")
  const pacer = options.pacer ?? scanHostPacer
  // Les options ne peuvent que resserrer les bornes ; seuls le développement et les tests
  // raccourcissent l'intervalle de politesse.
  const intervalMs = Math.max(
    policy.environment === "production" ? scanLimits.minIntervalMs : 0,
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
  const userAgent = scanUserAgent({ name: site.name, url: env.BETTER_AUTH_URL })
  const robotsCache = new Map<string, Promise<Robots | ScanFailure>>()

  async function checkedAddresses(
    url: URL,
    hostname: string,
    signal: AbortSignal,
  ) {
    if (isTestSourceUrl(url, policy))
      return [{ address: "127.0.0.1", family: 4 }]
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await abortable(resolve(hostname), signal)
    return addresses.length &&
      addresses.every(({ address }) => isPublicAddress(address))
      ? addresses
      : null
  }

  // Un échange HTTP : adresses contrôlées, tour de l'hôte, puis `timeoutMs` depuis l'envoi.
  async function send(
    url: URL,
    reading: Reading,
    purpose: Purpose,
    crawlDelayMs: number,
  ): Promise<Exchange | ScanFailure> {
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    const resolvedAt = Date.now()
    const exchangeMs = Math.min(
      timeoutMs,
      reading.exchangeTimeoutMs ?? timeoutMs,
    )
    const addresses = await checkedAddresses(
      url,
      hostname,
      AbortSignal.any([reading.signal, AbortSignal.timeout(exchangeMs)]),
    )
    reading.elapsedMs += Date.now() - resolvedAt
    if (!addresses) return { ok: false, reason: "blocked_address" }
    // Le nom reste dans Host et SNI ; la socket n'utilise que des adresses contrôlées,
    // toutes proposées pour que Node puisse basculer de l'une à l'autre.
    const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) callback(null, addresses)
      else callback(null, addresses[0].address, addresses[0].family)
    }
    try {
      return await pacer.run(
        hostname,
        Math.max(intervalMs, crawlDelayMs),
        reading,
        async (waitedMs) => {
          reading.waitedMs += waitedMs
          const sentAt = Date.now()
          try {
            return await exchange(
              url,
              hostname,
              purpose,
              lookup,
              AbortSignal.any([
                reading.signal,
                AbortSignal.timeout(exchangeMs),
              ]),
            )
          } finally {
            reading.elapsedMs += Date.now() - sentAt
          }
        },
      )
    } catch (error) {
      if (error instanceof HostDeferral)
        return { ok: false, reason: "rate_limited", retryAfterMs: error.waitMs }
      throw error
    }
  }

  function exchange(
    url: URL,
    hostname: string,
    purpose: Purpose,
    lookup: LookupFunction,
    signal: AbortSignal,
  ) {
    const local = isTestSourceUrl(url, policy)
    return new Promise<Exchange | ScanFailure>((resolveResponse, reject) => {
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
          const contentTypeHeader = headers["content-type"] ?? ""
          const contentType = contentTypeHeader
            .split(";")[0]
            .trim()
            .toLowerCase()
          if (status === 429 || status === 503) {
            const retry = retryAfterMs(headers["retry-after"])
            if (retry !== undefined) pacer.defer(hostname, retry)
            else if (status === 429)
              pacer.defer(hostname, scanLimits.defaultRetryAfterMs)
          }
          const empty = { status, headers, contentType, body: "", bytes: 0 }
          if (status < 200 || status >= 300) {
            response.destroy()
            resolveResponse(empty)
            return
          }
          // robots.txt se lit quel que soit son type (RFC 9309) ; une page, seulement si admise.
          if (purpose === "page" && !allowedTypes.has(contentType)) {
            response.destroy()
            resolveResponse({ ok: false, reason: "unsupported_type", status })
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
            resolveResponse({ ok: false, reason: "unsupported_type", status })
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
            () => {
              const raw = Buffer.concat(chunks)
              const charset = declaredCharset(
                contentTypeHeader,
                contentType.includes("json")
                  ? ""
                  : raw.subarray(0, 1024).toString("latin1"),
              )
              const body = decodeBody(raw, charset)
              resolveResponse(
                body === null
                  ? { ok: false, reason: "unsupported_type", status }
                  : { status, headers, contentType, body, bytes },
              )
            },
            (error) =>
              tooLarge
                ? resolveResponse({ ok: false, reason: "too_large", status })
                : reject(error),
          )
        },
      )
      request.on("error", reject)
      request.end()
    })
  }

  // Redirections manuelles, 5 au plus : chaque adresse repasse checkScanUrl puis `read`.
  async function follow(
    start: string,
    read: (url: URL) => Promise<Exchange | ScanFailure>,
  ): Promise<
    { url: URL; response: Exchange } | (ScanFailure & { finalUrl?: string })
  > {
    let current = start
    for (let redirects = 0; ; redirects++) {
      const url = checkScanUrl(current, policy)
      if (!url) return { ok: false, reason: "invalid_url" }
      const response = await read(url)
      if (isFailure(response)) return { ...response, finalUrl: url.href }
      if (!redirectStatuses.has(response.status)) return { url, response }
      const failure = {
        ok: false as const,
        status: response.status,
        finalUrl: url.href,
      }
      if (redirects >= scanLimits.maxRedirects)
        return { ...failure, reason: "too_many_redirects" }
      if (!response.headers.location)
        return { ...failure, reason: "http_error" }
      try {
        current = new URL(response.headers.location, url).href
      } catch {
        return { ...failure, reason: "invalid_url" }
      }
    }
  }

  function getRobots(url: URL, reading: Reading) {
    let rules = robotsCache.get(url.origin)
    if (!rules) {
      rules = readRobots(new URL("/robots.txt", url), reading)
      robotsCache.set(url.origin, rules)
    }
    return abortable(rules, reading.signal)
  }

  async function readRobots(
    robotsUrl: URL,
    reading: Reading,
  ): Promise<Robots | ScanFailure> {
    try {
      // robots.txt n'obéit à aucun robots.txt ; ses redirections restent contrôlées.
      const result = await follow(robotsUrl.href, (url) =>
        send(url, reading, "robots", 0),
      )
      if (isFailure(result)) return result
      const { status, headers, body } = result.response
      // 404 : tout est permis ; toute autre erreur rend l'hôte indisponible pour l'étape.
      if (status !== 404 && (status < 200 || status >= 300))
        return failureForStatus(status, headers)
      const text = status === 404 ? "" : body
      const parser = robotsParser(robotsUrl.href, text)
      const seconds = parser.getCrawlDelay(userAgent)
      return {
        parser,
        status,
        digest: createHash("sha256").update(text).digest("hex"),
        crawlDelayMs:
          seconds && Number.isFinite(seconds) && seconds > 0
            ? Math.min(seconds * 1_000, Number.MAX_SAFE_INTEGER)
            : 0,
      }
    } catch (error) {
      return { ok: false, reason: isAbort(error) ? "timeout" : "network" }
    }
  }

  async function scanFetch(
    value: string,
    {
      deadline = Date.now() + scanLimits.batchBudgetMs,
      signal,
      exchangeTimeoutMs,
    }: ScanFetchOptions = {},
  ): Promise<ScanFetchResult> {
    const budget = AbortSignal.timeout(Math.max(0, deadline - Date.now()))
    const reading: Reading = {
      signal: signal ? AbortSignal.any([signal, budget]) : budget,
      deadline,
      exchangeTimeoutMs,
      elapsedMs: 0,
      waitedMs: 0,
    }
    const robots: RobotsDecision[] = []
    let lastUrl: string | undefined
    const done = (outcome: ScanFetchOutcome): ScanFetchResult => ({
      ...outcome,
      robots,
      elapsedMs: reading.elapsedMs,
      waitedMs: reading.waitedMs,
    })
    try {
      const result = await follow(value, async (url) => {
        lastUrl = url.href
        const rules = await getRobots(url, reading)
        const robotsUrl = new URL("/robots.txt", url).href
        if (isFailure(rules)) {
          robots.push({
            url: robotsUrl,
            status: rules.status,
            allowed: false,
            crawlDelayMs: 0,
            reason: rules.reason,
          })
          return rules
        }
        const allowed = rules.parser.isAllowed(url.href, userAgent) !== false
        robots.push({
          url: robotsUrl,
          status: rules.status,
          allowed,
          crawlDelayMs: rules.crawlDelayMs,
          digest: rules.digest,
        })
        if (!allowed) return { ok: false, reason: "robots_disallowed" }
        return send(url, reading, "page", rules.crawlDelayMs)
      })
      if (isFailure(result)) return done(result)
      const { url, response } = result
      if (response.status < 200 || response.status >= 300)
        return done({
          ...failureForStatus(response.status, response.headers),
          finalUrl: url.href,
        })
      return done({
        ok: true,
        status: response.status,
        finalUrl: url.href,
        contentType: response.contentType,
        body: response.body,
        bytes: response.bytes,
        fetchedAt: new Date().toISOString(),
      })
    } catch (error) {
      return done({
        ok: false,
        reason: isAbort(error) ? "timeout" : "network",
        finalUrl: lastUrl,
      })
    }
  }
  return { scanFetch }
}

export function scanFetch(url: string, options?: ScanHttpOptions) {
  return createScanHttpClient(options).scanFetch(url)
}
