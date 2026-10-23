import { expect, it, vi } from "vitest"

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://saisonnier.example",
  },
}))

import { createScanHttpClient } from "./http"
import type { HostPacer } from "./host-pacer"

it("refuse une politique de test dans un processus de production", () => {
  expect(() =>
    createScanHttpClient({
      policy: { environment: "test", testSourceUrl: "http://localhost:3210" },
    }),
  ).toThrow("Politique de test interdite")
})

it("en production, l'intervalle de politesse ne descend jamais sous 2 s", async () => {
  const intervals: number[] = []
  const pacer = {
    run: async (_host: string, intervalMs: number) => {
      intervals.push(intervalMs)
      throw new Error("aucun réseau dans ce test")
    },
    defer: () => {},
  } as unknown as HostPacer
  const client = createScanHttpClient({
    minIntervalMs: 0,
    pacer,
    resolve: async () => [{ address: "8.8.8.8", family: 4 }],
  })
  await client.scanFetch("https://source.example/jobs")
  expect(intervals).toEqual([2_000])
})
