import "server-only"

import { franceTravailPostingDataUrl } from "@/domain/scan/france-travail"
import { stopsSource } from "@/domain/scan/http"
import { scanLimits } from "@/domain/scan/limits"
import type { ScanProbeRequest, ScanProbeResult } from "@/domain/scan/probe"
import type { ScanSourceDefinition } from "@/domain/scan/source"
import { env } from "@/lib/env"

import { createScanHttpClient } from "./http"
import { inspectScanDocument } from "./inspect"

// URL réellement lue pour une fiche : France Travail sert ses données publiques en JSON.
function postingReadUrl(source: ScanSourceDefinition, pageUrl: string) {
  return source.adapter === "france-travail"
    ? franceTravailPostingDataUrl(pageUrl)
    : null
}

export async function probeScanSource(
  source: ScanSourceDefinition,
): Promise<ScanProbeResult> {
  const { minIntervalMs, timeoutMs, maxBytes } = source.limits
  const client = createScanHttpClient({ minIntervalMs, timeoutMs, maxBytes })
  const deadline = Date.now() + scanLimits.probeBudgetMs
  const result: ScanProbeResult = {
    sourceKey: source.key,
    deploymentUrl: env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : env.BETTER_AUTH_URL,
    probedAt: new Date().toISOString(),
    requests: [],
  }
  async function read(
    url: string,
    kind: ScanProbeRequest["kind"],
    pageUrl?: string,
  ) {
    const response = await client.scanFetch(url, { deadline })
    const inspection = response.ok
      ? inspectScanDocument(response, source)
      : null
    result.requests.push({
      kind,
      url,
      pageUrl,
      ok: response.ok,
      status: response.status,
      finalUrl: response.finalUrl,
      robots: response.robots,
      elapsedMs: response.elapsedMs,
      waitedMs: response.waitedMs,
      ...(response.ok
        ? {
            bytes: response.bytes,
            contentType: response.contentType,
          }
        : { reason: response.reason }),
      jobPosting: inspection?.jobPosting ?? "absent",
      rssItems: inspection?.rssItems ?? 0,
      pagination: inspection?.pagination ?? false,
      postingLinks: inspection?.links.length ?? 0,
    })
    return { response, links: inspection?.links ?? [] }
  }
  // France Travail : la première page de chaque recherche ; les autres : la première liste.
  const links: string[] = []
  for (const url of source.adapter === "france-travail"
    ? source.listUrls
    : source.listUrls.slice(0, 1)) {
    const list = await read(url, "list")
    if (list.response.ok) links.push(...list.links)
    else if (stopsSource(list.response.reason)) break
  }
  if (links.length) {
    for (const url of [...new Set(links)].slice(0, 3)) {
      const dataUrl = postingReadUrl(source, url)
      const { response } = await read(
        dataUrl ?? url,
        "posting",
        dataUrl ? url : undefined,
      )
      // Refus explicite ou panne de l'hôte : aucune autre fiche de la source.
      if (!response.ok && stopsSource(response.reason)) break
    }
  }
  console.info("[scan sonde]", JSON.stringify(result))
  return result
}
