import { setTimeout } from "node:timers/promises"
import { expect, it } from "vitest"

import { HostPacer } from "./host-pacer"

it("une requête déjà annulée n'exécute rien et ne laisse pas de rejet non observé", async () => {
  const pacer = new HostPacer()
  let calls = 0
  await expect(
    pacer.run(
      "source.example",
      0,
      AbortSignal.abort(new Error("cancelled")),
      async () => {
        calls++
        return true
      },
    ),
  ).rejects.toThrow("cancelled")
  expect(
    await pacer.run("source.example", 0, AbortSignal.timeout(100), async () => {
      calls++
      return true
    }),
  ).toBe(true)
  expect(calls).toBe(1)
})

it("l'annulation d'une attente ne libère pas la requête précédente", async () => {
  const pacer = new HostPacer()
  let release!: () => void
  let firstActive = false
  const first = pacer.run(
    "source.example",
    0,
    AbortSignal.timeout(1000),
    async () => {
      firstActive = true
      await new Promise<void>((resolve) => {
        release = resolve
      })
      firstActive = false
    },
  )
  await setTimeout(0)
  const cancelled = pacer.run(
    "source.example",
    0,
    AbortSignal.timeout(20),
    async () => {
      throw new Error("must not run")
    },
  )
  const third = pacer.run(
    "source.example",
    0,
    AbortSignal.timeout(1000),
    async () => {
      expect(firstActive).toBe(false)
      return true
    },
  )
  await expect(cancelled).rejects.toBeDefined()
  expect(firstActive).toBe(true)
  release()
  await first
  expect(await third).toBe(true)
})

it("conserve le délai déjà appris pour l'hôte entre deux clients", async () => {
  const pacer = new HostPacer()
  const start = Date.now()
  await pacer.run(
    "source.example",
    80,
    AbortSignal.timeout(1000),
    async () => true,
  )
  await pacer.run(
    "source.example",
    0,
    AbortSignal.timeout(1000),
    async () => true,
  )
  expect(Date.now() - start).toBeGreaterThanOrEqual(70)
})
