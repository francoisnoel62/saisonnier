import { and, eq } from "drizzle-orm"
import { afterAll, beforeEach, expect, it, vi } from "vitest"

import {
  enableScanSource,
  insertScanRun,
  resetScan,
} from "../../../../e2e/helpers/scan"
import { db } from "@/lib/db"
import {
  scanReviews,
  scanRunSources,
  scanSourceEvents,
  user,
} from "@/lib/db/schema"

const mocks = vi.hoisted(() => ({ probe: vi.fn() }))
vi.mock("../probe", () => ({ probeScanSource: mocks.probe }))
vi.mock("../sample", () => ({ sampleScanSource: vi.fn() }))

import {
  applyCircuitBreaker,
  resumeSource,
  sourceActivity,
  sourceHealthSummaries,
} from "./health"
import { getScanSource } from "./registry"
import { runSourceTest } from "./tests"

const adminId = `health-${crypto.randomUUID()}`
beforeEach(async () => {
  await resetScan(db.$client)
  await db
    .insert(user)
    .values({
      id: adminId,
      name: "Admin santé",
      email: `${adminId}@test.example`,
      role: "admin",
    })
    .onConflictDoNothing()
  mocks.probe.mockResolvedValue({
    sourceKey: "vvf",
    deploymentUrl: "http://localhost",
    probedAt: new Date().toISOString(),
    requests: [{ ok: true }],
  })
})
afterAll(async () => {
  await resetScan(db.$client)
  await db.delete(user).where(eq(user.id, adminId))
})

// Passage quotidien terminé où la source a l'état donné.
async function finishedRun(
  daysAgo: number,
  status: "done" | "blocked" | "failed",
  extra: Partial<typeof scanRunSources.$inferInsert> = {},
) {
  const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const run = await insertScanRun(db.$client, {
    mode: "daily",
    startedAt,
    status: "completed",
    finishedAt: startedAt,
  })
  await db.insert(scanRunSources).values({
    runId: run.id,
    sourceKey: "vvf",
    sourceRevision: 1,
    status,
    listedCount: 10,
    deliveredCount: status === "done" ? 2 : 0,
    requestCount: 12,
    bytesDownloaded: 2048,
    ...extra,
  })
  return run
}

it("trois passages bloqués de suite : suspension motivée, incident en revue, puis reprise après un test réussi", async () => {
  await enableScanSource(db.$client, "vvf")
  await finishedRun(3, "blocked")
  await finishedRun(2, "blocked")
  const last = await finishedRun(1, "blocked")
  const suspended = await db.transaction((tx) =>
    applyCircuitBreaker(tx, last.id),
  )
  expect(suspended).toEqual([{ key: "vvf", label: "VVF" }])
  const source = (await getScanSource("vvf"))!
  expect(source.suspendedAt).not.toBeNull()
  expect(source.suspensionReason).toContain(
    "Trois passages consécutifs bloqués",
  )
  const [incident] = await db
    .select()
    .from(scanReviews)
    .where(eq(scanReviews.groupKey, "source:vvf:suspendue"))
  expect(incident).toMatchObject({ kind: "incident", status: "open" })
  expect((await sourceHealthSummaries()).get("vvf")?.health).toBe("suspended")
  // Rejouer la fin de passage ne suspend pas deux fois.
  expect(
    await db.transaction((tx) => applyCircuitBreaker(tx, last.id)),
  ).toEqual([])

  expect(await resumeSource("vvf", source.version, adminId)).toMatchObject({
    ok: false,
    reason: "blocked",
  })
  expect(await runSourceTest("vvf", "probe", adminId)).toMatchObject({
    ok: true,
    succeeded: true,
  })
  expect(await resumeSource("vvf", source.version, adminId)).toMatchObject({
    ok: true,
  })
  expect(await getScanSource("vvf")).toMatchObject({
    suspendedAt: null,
    suspensionReason: null,
  })
  const events = await db
    .select({ kind: scanSourceEvents.kind })
    .from(scanSourceEvents)
    .where(and(eq(scanSourceEvents.sourceKey, "vvf")))
  expect(events.map((event) => event.kind)).toEqual(
    expect.arrayContaining(["suspended", "resumed"]),
  )
})

it("une indisponibilité ou deux blocages ne suspendent pas", async () => {
  await finishedRun(3, "blocked")
  await finishedRun(2, "failed")
  const last = await finishedRun(1, "blocked")
  expect(
    await db.transaction((tx) => applyCircuitBreaker(tx, last.id)),
  ).toEqual([])
  expect((await getScanSource("vvf"))?.suspendedAt).toBeNull()
})

it("rendement et coût sur 30 jours ; robots.txt modifié signalé", async () => {
  await finishedRun(40, "done")
  await finishedRun(2, "done", { robotsDigest: "a" })
  await finishedRun(1, "done", { robotsDigest: "b", failedCount: 1 })
  const activity = await sourceActivity("vvf")
  expect(activity.totals).toMatchObject({
    runs: 2,
    listed: 20,
    delivered: 4,
    requests: 24,
    bytes: 4096,
    failed: 1,
  })
  expect(activity.runs).toHaveLength(3)
  expect(activity.autoPublish).toMatchObject({ ready: false, clean: 2 })
  const health = (await sourceHealthSummaries()).get("vvf")
  expect(health).toMatchObject({ health: "degraded", robotsChanged: true })
})
