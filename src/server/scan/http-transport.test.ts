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
