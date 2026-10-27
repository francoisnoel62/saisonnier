import "server-only"

import {
  detectSource,
  detectWithoutReading,
  shouldSkipRead,
  type DetectionResult,
} from "@/domain/scan/detection"
import { scanFailureLabels } from "@/domain/scan/http"
import { scanLimits } from "@/domain/scan/limits"
import { checkScanUrl } from "@/domain/scan/url-safety"
import { env } from "@/lib/env"
import { getBlockedDomains } from "@/server/offers/application"

import { createScanHttpClient } from "../http"
import { detectionSignals } from "../inspect"
import { scanUrlPolicy } from "./registry"

// Lecture de la page de départ d'une source (§8.2) : deux requêtes au plus (la page, puis le
// flux qu'elle annonce), par le client du scan (robots.txt, politesse, adresses publiques).
export type DetectionRead =
  | { kind: "skipped" }
  | {
      kind: "read"
      ok: boolean
      status?: number
      failure?: string
      robotsAllowed: boolean | null
      requests: number
    }
export type DetectionReport = DetectionResult & {
  read: DetectionRead
  detectedAt: string
}
export type DetectionOutcome =
  | { ok: true; report: DetectionReport }
  | { ok: false; reason: "invalid" | "cooldown"; message: string }

// Délai de recharge par hôte, au mieux par instance : la politesse du client protège le reste.
const recentHosts = new Map<string, number>()

export async function detectStartUrl(
  value: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<DetectionOutcome> {
  const url =
    typeof value === "string" && value.length <= 2048
      ? checkScanUrl(value.trim(), scanUrlPolicy)
      : null
  if (!url)
    return {
      ok: false,
      reason: "invalid",
      message:
        "Adresse https publique attendue, sans identifiants ni port (ex. https://recrute.exemple.fr).",
    }
  const last = recentHosts.get(url.hostname)
  const wait = last ? last + scanLimits.sourceTestCooldownMs - now.getTime() : 0
  if (wait > 0)
    return {
      ok: false,
      reason: "cooldown",
      message: `Patientez ${Math.ceil(wait / 1000)} s avant une nouvelle lecture de ${url.hostname}.`,
    }
  const context = {
    blockedDomains: await getBlockedDomains(),
    testSourceUrl: env.SCAN_TEST_SOURCE_URL,
  }
  const detectedAt = now.toISOString()
  if (shouldSkipRead(url.href))
    return {
      ok: true,
      report: {
        ...detectWithoutReading(url.href, context),
        read: { kind: "skipped" },
        detectedAt,
      },
    }
  recentHosts.set(url.hostname, now.getTime())
  const client = createScanHttpClient()
  const deadline = now.getTime() + 60_000
  const page = await client.scanFetch(url.href, { deadline })
  const robotsAllowed = page.robots.length
    ? page.robots.every((robots) => robots.allowed)
    : null
  if (!page.ok)
    return {
      ok: true,
      report: {
        ...detectWithoutReading(url.href, context),
        notes: [],
        read: {
          kind: "read",
          ok: false,
          status: page.status,
          failure: scanFailureLabels[page.reason],
          robotsAllowed,
          requests: 1,
        },
        detectedAt,
      },
    }
  const signals = detectionSignals(page)
  let requests = 1
  // Flux annoncé sur le même hôte : sa structure confirme le format (Teamtailor).
  const feed = signals.feedLinks.find((link) => {
    try {
      return new URL(link).hostname === new URL(page.finalUrl).hostname
    } catch {
      return false
    }
  })
  if (feed && signals.rssItems === 0) {
    requests++
    const response = await client.scanFetch(feed, { deadline })
    if (response.ok) {
      const feedSignals = detectionSignals(response)
      signals.rssNamespaces = feedSignals.rssNamespaces
      signals.rssItems = feedSignals.rssItems
      signals.links = [...new Set([...signals.links, ...feedSignals.links])]
    }
  }
  return {
    ok: true,
    report: {
      ...detectSource(signals, context),
      read: {
        kind: "read",
        ok: true,
        status: page.status,
        robotsAllowed,
        requests,
      },
      detectedAt,
    },
  }
}
