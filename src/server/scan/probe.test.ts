import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("./http", () => ({
  createScanHttpClient: () => ({ scanFetch: mocks.fetch }),
}))

import { franceTravailPostingDataUrl } from "@/domain/scan/france-travail"
import { probeScanSource } from "./probe"
import { buildScanSourceDefinitions } from "./sources/registry"

afterEach(() => {
  vi.restoreAllMocks()
  mocks.fetch.mockReset()
})

it("sonde la liste France Travail et trois JSON publics, en conservant les fiches de découverte", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {})
  const source = buildScanSourceDefinitions()["france-travail"]
  const root = join(
    process.cwd(),
    "src/server/scan/sources/fixtures/france-travail",
  )
  mocks.fetch.mockImplementation(async (url: string) => {
    const index = mocks.fetch.mock.calls.length - 1
    return {
      ok: true,
      status: 200,
      finalUrl: url,
      contentType: index === 0 ? "text/html" : "application/json",
      body: readFileSync(
        join(root, index === 0 ? "list.html" : `posting-${index}.json`),
        "utf8",
      ),
      bytes: 100,
      elapsedMs: 20,
      fetchedAt: "2026-10-23T13:00:00Z",
      robots: [
        {
          url: "https://candidat.francetravail.fr/robots.txt",
          status: 200,
          allowed: true,
          crawlDelayMs: 0,
        },
      ],
    }
  })
  const result = await probeScanSource(source)
  expect(result.requests).toHaveLength(4)
  expect(result.requests[0]).toMatchObject({
    kind: "list",
    postingLinks: 20,
    pagination: true,
  })
  for (const request of result.requests.slice(1)) {
    expect(request).toMatchObject({
      kind: "posting",
      ok: true,
      contentType: "application/json",
    })
    expect(request.pageUrl).toBeDefined()
    expect(request.url).toBe(franceTravailPostingDataUrl(request.pageUrl!))
  }
  expect(mocks.fetch.mock.calls[0][0]).toBe(source.listUrls[0])
  expect(JSON.stringify(result)).not.toContain("MISSIONS DU POSTE")
})

it("arrête la source après un refus de fiche et ne journalise jamais son contenu", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {})
  const source = buildScanSourceDefinitions().belambra
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: source.listUrls[0],
      contentType: "text/html",
      body: '<a href="/jobs/1-secret">secret</a><a href="/jobs/2-second">second</a>',
      bytes: 20,
      elapsedMs: 1,
      fetchedAt: "2026-10-23T13:00:00Z",
      robots: [],
    })
    .mockResolvedValueOnce({
      ok: false,
      reason: "access_denied",
      status: 403,
      finalUrl: "https://recrute.belambra.fr/jobs/1-secret",
      robots: [],
    })
  expect((await probeScanSource(source)).requests).toHaveLength(2)
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
  expect(log.mock.calls[0][1]).not.toContain("<a")
})

it("une fiche introuvable n'empêche pas de lire les suivantes", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {})
  const source = buildScanSourceDefinitions().belambra
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: source.listUrls[0],
      contentType: "text/html",
      body: '<a href="/jobs/1-a">a</a><a href="/jobs/2-b">b</a><a href="/jobs/3-c">c</a>',
      bytes: 20,
      elapsedMs: 1,
      waitedMs: 0,
      fetchedAt: "2026-10-23T13:00:00Z",
      robots: [],
    })
    .mockResolvedValueOnce({
      ok: false,
      reason: "not_found",
      status: 404,
      elapsedMs: 1,
      waitedMs: 0,
      robots: [],
    })
    .mockResolvedValue({
      ok: true,
      status: 200,
      finalUrl: "https://recrute.belambra.fr/jobs/2-b",
      contentType: "text/html",
      body: "<p>fiche</p>",
      bytes: 12,
      elapsedMs: 1,
      waitedMs: 0,
      fetchedAt: "2026-10-23T13:00:00Z",
      robots: [],
    })
  expect((await probeScanSource(source)).requests).toHaveLength(4)
})
