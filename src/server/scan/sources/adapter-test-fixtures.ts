import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { vi } from "vitest"

import type { ScanFetchResult } from "@/domain/scan/http"
import { departmentFromPostalCode } from "@/domain/scan/locale"
import type { ScanSourceDefinition } from "@/domain/scan/source"

import type { AdapterContext } from "./adapter"
import { buildScanSourceDefinitions } from "./registry"

export const sampleNow = "2026-10-24T10:00:00.000Z"
export const testDefinitions = buildScanSourceDefinitions(
  "http://localhost:3200",
)
export function fixtureFile(source: string, file: string) {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${source}/${file}`, import.meta.url)),
    "utf8",
  )
}
export function success(
  body: string,
  url: string,
  contentType = "text/html",
): ScanFetchResult {
  return {
    ok: true,
    status: 200,
    body,
    finalUrl: url,
    contentType,
    bytes: Buffer.byteLength(body),
    fetchedAt: sampleNow,
    elapsedMs: 1,
    waitedMs: 0,
    robots: [],
  }
}
export function context(
  source: ScanSourceDefinition = testDefinitions.belambra,
  documents: Record<string, string> = {},
): AdapterContext {
  const scanFetch = vi.fn(async (url: string): Promise<ScanFetchResult> => {
    if (url in documents) return success(documents[url], url)
    const target = new URL(url)
    if (target.hostname === "geo.api.gouv.fr") {
      const postalCode = target.searchParams.get("codePostal")!
      const department = departmentFromPostalCode(postalCode)
      return success(
        JSON.stringify([
          {
            nom: target.searchParams.get("nom"),
            code: `${department}001`,
            codesPostaux: [postalCode],
            codeDepartement: department,
          },
        ]),
        url,
        "application/json",
      )
    }
    return {
      ok: false,
      status: 404,
      reason: "not_found",
      elapsedMs: 1,
      waitedMs: 0,
      robots: [],
    }
  })
  return {
    source,
    scanFetch,
    now: sampleNow,
    deadline: Date.now() + 100_000,
    log: vi.fn(),
    departmentCodes: Array.from({ length: 95 }, (_, index) =>
      String(index + 1).padStart(2, "0"),
    )
      .filter((code) => code !== "20")
      .concat(["2A", "2B", "971", "972", "973", "974", "976"]),
  }
}
