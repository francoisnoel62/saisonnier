import "server-only"

import { franceTravailPostingDataUrl } from "@/domain/scan/france-travail"

import type { ScanProbeRequest, ScanProbeResult } from "@/domain/scan/probe"
import type { ScanSourceDefinition } from "@/domain/scan/source"
import { env } from "@/lib/env"

import { createScanHttpClient } from "./http"
import { inspectScanDocument } from "./inspect"

export async function probeScanSource(
  source: ScanSourceDefinition,
): Promise<ScanProbeResult> {
  const client = createScanHttpClient(source.limits)
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
    const start = Date.now()
    const response = await client.scanFetch(url)
    const inspection = response.ok
      ? inspectScanDocument(
          response.body,
          response.finalUrl,
          response.contentType,
          source,
        )
      : null
    result.requests.push({
      kind,
      url,
      pageUrl,
      ok: response.ok,
      status: response.status,
      finalUrl: response.finalUrl,
      robots: response.robots,
      elapsedMs: response.ok ? response.elapsedMs : Date.now() - start,
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
  const list = await read(source.listUrls[0], "list")
  if (list.response.ok) {
    for (const url of list.links.slice(0, 3)) {
      const dataUrl =
        source.adapter === "france-travail"
          ? franceTravailPostingDataUrl(url)
          : null
      const { response } = await read(
        dataUrl ?? url,
        "posting",
        dataUrl ? url : undefined,
      )
      // Refus explicite ou panne de l'hôte : aucune autre fiche de la source.
      if (!response.ok) break
    }
  }
  console.info("[scan sonde]", JSON.stringify(result))
  return result
}
