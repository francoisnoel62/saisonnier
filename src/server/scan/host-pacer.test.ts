import { setTimeout } from "node:timers/promises"
import { expect, it } from "vitest"

import { HostDeferral, HostPacer } from "./host-pacer"

function turn(ms: number, deadline = Date.now() + 60_000) {
  return { signal: AbortSignal.timeout(ms), deadline }
}

it("une requête déjà annulée n'exécute rien et ne laisse pas de rejet non observé", async () => {
  const pacer = new HostPacer()
  let calls = 0
  await expect(
    pacer.run(
      "source.example",
      0,
      {
        signal: AbortSignal.abort(new Error("cancelled")),
        deadline: Date.now() + 1000,
      },
      async () => {
        calls++
        return true
      },
    ),
  ).rejects.toThrow("cancelled")
  expect(
    await pacer.run("source.example", 0, turn(100), async () => {
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
  const first = pacer.run("source.example", 0, turn(1000), async () => {
    firstActive = true
    await new Promise<void>((resolve) => {
      release = resolve
    })
    firstActive = false
  })
  await setTimeout(0)
  const cancelled = pacer.run("source.example", 0, turn(20), async () => {
    throw new Error("must not run")
  })
  const third = pacer.run("source.example", 0, turn(1000), async () => {
    expect(firstActive).toBe(false)
    return true
  })
  await expect(cancelled).rejects.toBeDefined()
  expect(firstActive).toBe(true)
  release()
  await first
  expect(await third).toBe(true)
})

it("conserve le délai déjà appris pour l'hôte entre deux clients et transmet l'attente subie", async () => {
  const pacer = new HostPacer()
  const start = Date.now()
  await pacer.run("source.example", 80, turn(1000), async () => true)
  const waited = await pacer.run(
    "source.example",
    0,
    turn(1000),
    async (waitedMs) => waitedMs,
  )
  expect(Date.now() - start).toBeGreaterThanOrEqual(70)
  expect(waited).toBeGreaterThanOrEqual(70)
})

it("refuse d'emblée une attente qui dépasse l'échéance de l'appelant", async () => {
  const pacer = new HostPacer()
  pacer.defer("source.example", 5_000)
  let called = false
  const started = Date.now()
  const error = await pacer
    .run("source.example", 0, turn(10_000, Date.now() + 1_000), async () => {
      called = true
    })
    .catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(HostDeferral)
  expect((error as HostDeferral).waitMs).toBeGreaterThan(4_000)
  expect(called).toBe(false)
  expect(Date.now() - started).toBeLessThan(100)
})
