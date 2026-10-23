import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http"
import { once } from "node:events"
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib"
import { afterEach, describe, expect, it } from "vitest"

import { createScanHttpClient, retryAfterMs } from "./http"
import { HostPacer } from "./host-pacer"

const servers: Server[] = []
async function server(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  options = {},
) {
  const instance = createServer(handler)
  servers.push(instance)
  instance.listen(0, "127.0.0.1")
  await once(instance, "listening")
  const address = instance.address()
  if (!address || typeof address === "string") throw new Error("No port")
  const origin = `http://localhost:${address.port}`
  return {
    origin,
    ...createScanHttpClient({
      policy: { environment: "test", testSourceUrl: origin },
      pacer: new HostPacer(),
      minIntervalMs: 0,
      ...options,
    }),
  }
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
          server.closeAllConnections()
        }),
    ),
  )
})

function html(res: ServerResponse, body = "<html>ok</html>") {
  res.writeHead(200, { "Content-Type": "text/html" })
  res.end(body)
}
function noRobots(req: IncomingMessage, res: ServerResponse) {
  if (req.url !== "/robots.txt") return false
  res.writeHead(404)
  res.end()
  return true
}

describe("scanFetch, serveur HTTP local explicitement autorisé", () => {
  it("lit une réponse typée, s'identifie et conserve robots une fois par étape", async () => {
    let robots = 0
    const client = await server((req, res) => {
      expect(req.headers["user-agent"]).toContain("SaisonnierBot/1.0 (+")
      expect(req.headers["accept-language"]).toBe("fr-FR,fr;q=0.9")
      if (req.url === "/robots.txt") robots++
      if (!noRobots(req, res)) html(res)
    })
    const result = await client.scanFetch(client.origin)
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html>ok</html>",
      bytes: 15,
    })
    if (result.ok) expect(result.finalUrl).toBe(`${client.origin}/`)
    await client.scanFetch(`${client.origin}/second`)
    expect(robots).toBe(1)
  })
  it.each([
    "https://127.0.0.1/private",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::ffff:127.0.0.1]/private",
    "http://localhost:9/private",
  ])("refuse une redirection interne %s", async (target) => {
    const client = await server((req, res) => {
      if (!noRobots(req, res)) {
        res.writeHead(302, { Location: target })
        res.end()
      }
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason: target.startsWith("http:") ? "invalid_url" : "blocked_address",
    })
  })
  it("refuse toutes les réponses DNS si une seule est privée", async () => {
    const client = createScanHttpClient({
      resolve: async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ],
    })
    expect(await client.scanFetch("https://source.example/jobs")).toMatchObject(
      { ok: false, reason: "blocked_address" },
    )
  })
  it("le délai total inclut une résolution DNS suspendue", async () => {
    const client = createScanHttpClient({
      timeoutMs: 40,
      resolve: async () => new Promise(() => {}),
    })
    expect(await client.scanFetch("https://source.example/jobs")).toMatchObject(
      { ok: false, reason: "timeout" },
    )
  })
  it.each(["identity", "gzip", "deflate", "br"])(
    "arrête une réponse de plus de 2 Mo après décompression (%s)",
    async (encoding) => {
      const body = Buffer.alloc(2 * 1024 * 1024 + 1, "a")
      const encoded =
        encoding === "gzip"
          ? gzipSync(body)
          : encoding === "deflate"
            ? deflateSync(body)
            : encoding === "br"
              ? brotliCompressSync(body)
              : body
      const client = await server((req, res) => {
        if (noRobots(req, res)) return
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Content-Encoding": encoding,
        })
        res.end(encoded)
      })
      expect(await client.scanFetch(client.origin)).toMatchObject({
        ok: false,
        reason: "too_large",
        status: 200,
      })
    },
  )
  it("interrompt une réponse suspendue", async () => {
    const client = await server(
      (req, res) => {
        if (!noRobots(req, res)) {
          res.writeHead(200, { "Content-Type": "text/html" })
          res.write("first bytes")
        }
      },
      { timeoutMs: 80 },
    )
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason: "timeout",
    })
  })
  it("robots interdit la page : aucune requête vers celle-ci", async () => {
    const pages: string[] = []
    const client = await server((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("User-agent: *\nDisallow: /private\n")
      } else {
        pages.push(req.url ?? "")
        html(res)
      }
    })
    expect(await client.scanFetch(`${client.origin}/private`)).toMatchObject({
      ok: false,
      reason: "robots_disallowed",
    })
    expect(pages).toEqual([])
  })
  it("les règles de notre bot ont priorité sur *", async () => {
    const client = await server((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end(
          "User-agent: *\nDisallow: /\n\nUser-agent: SaisonnierBot\nAllow: /\n",
        )
      } else html(res)
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({ ok: true })
  })
  it.each([401, 403, 500, 503])(
    "robots HTTP %i rend l'hôte indisponible",
    async (status) => {
      let pages = 0
      const client = await server((req, res) => {
        if (req.url === "/robots.txt") {
          res.writeHead(status)
          res.end()
        } else {
          pages++
          html(res)
        }
      })
      expect(await client.scanFetch(client.origin)).toMatchObject({
        ok: false,
        status,
      })
      expect(pages).toBe(0)
    },
  )
  it("un délai robots dépassé ne lit aucune page", async () => {
    let pages = 0
    const client = await server(
      (req, res) => {
        if (req.url !== "/robots.txt") {
          pages++
          html(res)
        }
      },
      { timeoutMs: 50 },
    )
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason: "timeout",
    })
    expect(pages).toBe(0)
  })
  it.each([429, 503])("HTTP %i et Retry-After: 120", async (status) => {
    const client = await server((req, res) => {
      if (!noRobots(req, res)) {
        res.writeHead(status, { "Retry-After": "120" })
        res.end()
      }
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason: "rate_limited",
      status,
      retryAfterMs: 120000,
    })
  })
  it("deux requêtes concurrentes sont sérialisées et espacées, robots compris", async () => {
    const times: number[] = []
    const client = await server(
      (req, res) => {
        times.push(Date.now())
        if (!noRobots(req, res)) html(res)
      },
      { minIntervalMs: 80 },
    )
    const responses = await Promise.all([
      client.scanFetch(`${client.origin}/one`),
      client.scanFetch(`${client.origin}/two`),
    ])
    expect(responses.every((response) => response.ok)).toBe(true)
    expect(times).toHaveLength(3)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(70)
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(70)
  })
  it("respecte un Crawl-delay plus long que l'intervalle minimal", async () => {
    const times: number[] = []
    const client = await server((req, res) => {
      times.push(Date.now())
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("User-agent: *\nCrawl-delay: 0.1\n")
      } else html(res)
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({ ok: true })
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(90)
  })
  it("borne les redirections et revérifie robots sur les chemins redirigés", async () => {
    const client = await server((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("User-agent: *\nDisallow: /private\n")
      } else {
        res.writeHead(302, {
          Location: req.url === "/blocked" ? "/private" : "/loop",
        })
        res.end()
      }
    })
    expect(await client.scanFetch(`${client.origin}/loop`)).toMatchObject({
      ok: false,
      reason: "too_many_redirects",
    })
    expect(await client.scanFetch(`${client.origin}/blocked`)).toMatchObject({
      ok: false,
      reason: "robots_disallowed",
    })
  })
  it.each([
    [401, "access_denied"],
    [403, "access_denied"],
    [404, "not_found"],
    [410, "gone"],
    [500, "http_error"],
    [503, "http_error"],
  ])("résultat typé pour HTTP %i", async (status, reason) => {
    const client = await server((req, res) => {
      if (!noRobots(req, res)) {
        res.writeHead(Number(status))
        res.end()
      }
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason,
      status,
    })
  })
  it("refuse un type de contenu non admis", async () => {
    const client = await server((req, res) => {
      if (!noRobots(req, res)) {
        res.writeHead(200, { "Content-Type": "application/pdf" })
        res.end("pdf")
      }
    })
    expect(await client.scanFetch(client.origin)).toMatchObject({
      ok: false,
      reason: "unsupported_type",
    })
  })
  it("interprète aussi Retry-After sous forme de date", () => {
    const now = Date.parse("2026-10-23T12:00:00Z")
    expect(retryAfterMs("Fri, 23 Oct 2026 12:02:00 GMT", now)).toBe(120000)
  })
})
