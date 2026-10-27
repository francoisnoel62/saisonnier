import { EventEmitter } from "node:events"
import type { IncomingMessage } from "node:http"
import type { RequestOptions } from "node:https"
import { Readable } from "node:stream"
import { expect, it, vi } from "vitest"

const transport = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("node:https", () => ({ request: transport.request }))

import { createScanHttpClient } from "./http"
import { HostPacer } from "./host-pacer"

it("épingle la socket aux adresses DNS contrôlées, sans seconde résolution implicite", async () => {
  const addresses: string[] = []
  transport.request.mockImplementation(
    (
      url: URL,
      options: RequestOptions,
      respond: (response: IncomingMessage) => void,
    ) => {
      expect(url.hostname).toBe("source.example")
      expect(options.agent).toBe(false)
      expect(options.lookup).toBeTypeOf("function")
      // Simule l'appel de Node 24 (autoSelectFamily : `all: true`). Aucun accès au résolveur système.
      options.lookup!("source.example", { all: true }, (_error, result) => {
        addresses.push(
          (result as unknown as { address: string }[])
            .map(({ address }) => address)
            .join(","),
        )
      })
      const request = new EventEmitter()
      Object.assign(request, {
        end() {
          const stream = Readable.from([
            Buffer.from(
              url.pathname === "/robots.txt"
                ? "User-agent: *\nAllow: /"
                : "<html>ok</html>",
            ),
          ])
          respond(
            Object.assign(stream, {
              statusCode: 200,
              headers: {
                "content-type":
                  url.pathname === "/robots.txt" ? "text/plain" : "text/html",
              },
            }) as IncomingMessage,
          )
        },
      })
      return request
    },
  )
  const resolve = vi.fn().mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "2001:4860:4860::8888", family: 6 },
  ])
  const client = createScanHttpClient({
    resolve,
    pacer: new HostPacer(),
    minIntervalMs: 0,
  })
  expect(await client.scanFetch("https://source.example/jobs")).toMatchObject({
    ok: true,
  })
  // Toutes les adresses validées sont proposées, et elles seules : Node peut basculer.
  expect(addresses).toEqual([
    "8.8.8.8,2001:4860:4860::8888",
    "8.8.8.8,2001:4860:4860::8888",
  ])
  // Une validation pour robots, une pour la page ; lookup ne résout rien à nouveau.
  expect(resolve).toHaveBeenCalledTimes(2)
  expect(transport.request).toHaveBeenCalledTimes(2)
})

function respondingTransport() {
  transport.request.mockImplementation(
    (
      url: URL,
      _options: RequestOptions,
      respond: (r: IncomingMessage) => void,
    ) =>
      Object.assign(new EventEmitter(), {
        end() {
          respond(
            Object.assign(
              Readable.from([
                Buffer.from(
                  url.pathname === "/robots.txt"
                    ? "User-agent: *\nAllow: /"
                    : "<html>ok</html>",
                ),
              ]),
              {
                statusCode: 200,
                headers: {
                  "content-type":
                    url.pathname === "/robots.txt" ? "text/plain" : "text/html",
                },
              },
            ) as IncomingMessage,
          )
        },
      }),
  )
}
const publicHost = vi
  .fn()
  .mockResolvedValue([{ address: "8.8.8.8", family: 4 }])

it("exchangeTimeoutMs borne l'échange, pas l'attente de politesse de l'hôte", async () => {
  transport.request.mockReset()
  respondingTransport()
  const client = createScanHttpClient({
    resolve: publicHost,
    pacer: new HostPacer(),
    minIntervalMs: 300,
  })
  // Trois lectures simultanées de l'hôte : la dernière attend plus que les 100 ms d'un échange.
  const results = await Promise.all(
    [1, 2, 3].map((n) =>
      client.scanFetch(`https://geo.example/communes?n=${n}`, {
        exchangeTimeoutMs: 100,
        deadline: Date.now() + 10_000,
      }),
    ),
  )
  expect(results.map((result) => result.ok)).toEqual([true, true, true])
  expect(Math.max(...results.map((result) => result.waitedMs))).toBeGreaterThan(
    200,
  )
})

it("exchangeTimeoutMs coupe un échange qui ne répond pas, sans attendre l'échéance de l'étape", async () => {
  transport.request.mockReset()
  transport.request.mockImplementation((_url: URL, options: RequestOptions) => {
    const request = new EventEmitter()
    options.signal?.addEventListener("abort", () =>
      request.emit(
        "error",
        Object.assign(new Error("aborted"), { name: "TimeoutError" }),
      ),
    )
    return Object.assign(request, { end() {} })
  })
  const client = createScanHttpClient({
    resolve: publicHost,
    pacer: new HostPacer(),
    minIntervalMs: 0,
  })
  const startedAt = Date.now()
  expect(
    await client.scanFetch("https://silent.example/jobs", {
      exchangeTimeoutMs: 50,
      deadline: Date.now() + 10_000,
    }),
  ).toMatchObject({ ok: false, reason: "timeout" })
  expect(Date.now() - startedAt).toBeLessThan(2_000)
})
