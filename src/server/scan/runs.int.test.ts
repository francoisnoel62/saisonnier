import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { insertScanRun, resetScan } from "../../../e2e/helpers/scan"
import { dateInZone } from "@/domain/scan/source-date"
import { db } from "@/lib/db"
import { scanRuns, user } from "@/lib/db/schema"

import {
  claimRun,
  createBootstrapRun,
  createDailyRun,
  finishRun,
  markProgress,
  renewClaim,
  requestStop,
} from "./runs"
import {
  initRunSources,
  updateRunSource,
  waitBeforeNextRequest,
} from "./run-sources"
import {
  listScanSources,
  setScanSourceAutoPublish,
  setScanSourceEnabled,
} from "./sources/state"
import { getActiveRun, getRunState, listRuns } from "./queries"

const now = new Date("2026-10-24T10:00:00Z")
const adminId = crypto.randomUUID()
beforeEach(async () => {
  await resetScan(db.$client)
  await db
    .insert(user)
    .values({
      id: adminId,
      name: "Admin scan fictif",
      email: `${adminId}@scan.example`,
      role: "admin",
    })
    .onConflictDoNothing()
})
afterAll(async () => {
  await resetScan(db.$client)
  await db.delete(user).where(eq(user.id, adminId))
})

it("un seul remplissage initial : un second lancement renvoie le passage existant, même en concurrence", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      createBootstrapRun({ requestedBy: adminId, now }),
    ),
  )
  expect(results.filter((r) => "created" in r && r.created)).toHaveLength(1)
  expect(new Set(results.map((r) => "run" in r && r.run.id)).size).toBe(1)
  const run = (await getActiveRun())!
  await finishRun(run.id, run.claimToken, "completed", now)
  expect(await createBootstrapRun({ requestedBy: adminId, now })).toMatchObject(
    { created: false, run: { id: run.id } },
  )
})

it("un seul passage actif : un passage quotidien pendant le remplissage initial est refusé", async () => {
  await createBootstrapRun({ requestedBy: adminId, now })
  expect(
    await createDailyRun({ date: "2026-10-24", now, trigger: "cron" }),
  ).toEqual({ ok: false, reason: "run_in_progress" })
})

it("un passage quotidien par jour de Paris, avec une fenêtre fixe de 72 h", async () => {
  const at = new Date("2026-10-24T23:30:00Z")
  const date = dateInZone(+at, "Europe/Paris")
  expect(date).toBe("2026-10-25")
  const first = await createDailyRun({ date, now: at, trigger: "cron" })
  if (!("run" in first)) throw new Error("Passage manquant")
  expect(first.run.windowStart).toEqual(new Date(+at - 72 * 3600_000))
  await finishRun(first.run.id, first.run.claimToken, "partial", at)
  expect(
    await createDailyRun({ date, now: at, trigger: "admin" }),
  ).toMatchObject({ created: false, run: { id: first.run.id } })
  expect(
    "created" in
      (await createDailyRun({ date: "2026-10-26", now: at, trigger: "cron" })),
  ).toBe(true)
  expect(() =>
    createDailyRun({ date: "2026-02-30", now, trigger: "cron" }),
  ).toThrow()
  expect(await listRuns()).toHaveLength(2)
})

it("reprise : ancien jeton refusé, échéance, compteur et seuil conservés", async () => {
  const run = await insertScanRun(db.$client, {
    deliveredCount: 50,
    targetReachedAt: now,
    status: "partial",
    finishedAt: now,
  })
  const resumed = await renewClaim(run.id, new Date(+now + 5 * 86400_000))
  if (!resumed.ok) throw new Error("Reprise refusée")
  expect(resumed.run).toMatchObject({
    deadlineAt: run.deadlineAt,
    deliveredCount: 50,
    targetReachedAt: now,
    startedAt: run.startedAt,
    finishedAt: null,
  })
  expect(resumed.run.claimToken).not.toBe(run.claimToken)
  expect(await claimRun(run.id, run.claimToken, "ancien", now)).toEqual({
    ok: false,
    reason: "superseded",
  })
  expect(await markProgress(run.id, run.claimToken, now)).toEqual({
    ok: false,
    reason: "superseded",
  })
  expect(await finishRun(run.id, run.claimToken, "failed", now)).toEqual({
    ok: false,
    reason: "superseded",
  })
  expect(await initRunSources(run.id, ["fixture"], run.claimToken)).toEqual({
    ok: false,
    reason: "superseded",
  })
  expect(
    await claimRun(run.id, resumed.run.claimToken, "nouveau", now),
  ).toMatchObject({ ok: true, run: { workflowRunId: "nouveau" } })
})

it("récupération active uniquement sur le jeton perdu ; arrêt, rejeu et fin", async () => {
  const run = await insertScanRun(db.$client)
  expect(await renewClaim(run.id, now)).toMatchObject({
    ok: false,
    reason: "orchestration_not_lost",
  })
  const recovered = await renewClaim(run.id, now, {
    lostClaimToken: run.claimToken,
  })
  if (!recovered.ok) throw new Error("Reprise refusée")
  expect(
    await renewClaim(run.id, now, { lostClaimToken: run.claimToken }),
  ).toMatchObject({ ok: false })
  await requestStop(run.id, now)
  await requestStop(run.id, new Date(+now + 1000))
  expect((await getActiveRun())?.stopRequestedAt).toEqual(now)
  expect(
    await claimRun(run.id, recovered.run.claimToken, "workflow", now),
  ).toMatchObject({ reason: "superseded" })
  expect(
    await finishRun(run.id, recovered.run.claimToken, "completed", now),
  ).toMatchObject({ run: { status: "stopped" } })
})

it("une reprise ne déplace pas un autre passage actif et ne reprend pas un passage terminé", async () => {
  const initial = await insertScanRun(db.$client, {
    status: "partial",
    finishedAt: now,
  })
  const daily = await createDailyRun({
    date: "2026-10-25",
    now,
    trigger: "cron",
  })
  if (!("run" in daily)) throw new Error("Passage manquant")
  expect(await renewClaim(initial.id, now)).toEqual({
    ok: false,
    reason: "run_in_progress",
  })
  await finishRun(daily.run.id, daily.run.claimToken, "completed", now)
  expect(await renewClaim(daily.run.id, now)).toMatchObject({
    reason: "not_resumable",
  })
})

it("avancement par source : initialisation rejouée, incréments SQL concurrents, politesse et jeton", async () => {
  const run = await insertScanRun(db.$client)
  await initRunSources(run.id, ["fixture", "fixture"], run.claimToken)
  await initRunSources(run.id, ["fixture"], run.claimToken)
  await Promise.all(
    Array.from({ length: 20 }, () =>
      updateRunSource(run.id, "fixture", run.claimToken, {
        requestCount: 1,
        bytesDownloaded: 123,
      }),
    ),
  )
  await updateRunSource(run.id, "fixture", run.claimToken, {
    lastRequestAt: now,
    cursor: { page: 2 },
  })
  expect((await getRunState(run.id))?.sources).toMatchObject([
    { requestCount: 20, bytesDownloaded: 2460, cursor: { page: 2 } },
  ])
  expect(
    await waitBeforeNextRequest(run.id, "fixture", 2000, new Date(+now + 500)),
  ).toBe(1500)
  expect(
    await waitBeforeNextRequest(run.id, "fixture", 2000, new Date(+now + 3000)),
  ).toBe(0)
  const resumed = await renewClaim(run.id, now, {
    lostClaimToken: run.claimToken,
  })
  expect(resumed.ok).toBe(true)
  expect(
    await updateRunSource(run.id, "fixture", run.claimToken, {
      requestCount: 1,
    }),
  ).toMatchObject({ reason: "superseded" })
})

it("sources désactivées sans ligne ; mises à jour indépendantes, attribuées à l'admin ; clé inconnue refusée", async () => {
  expect(
    (await listScanSources()).every((s) => !s.enabled && !s.autoPublish),
  ).toBe(true)
  await setScanSourceEnabled("belambra", true, adminId)
  await setScanSourceAutoPublish("belambra", true, adminId)
  await setScanSourceEnabled("belambra", false, adminId)
  expect(
    (await listScanSources()).find((s) => s.key === "belambra"),
  ).toMatchObject({ enabled: false, autoPublish: true })
  await expect(
    setScanSourceEnabled("__proto__", true, adminId),
  ).rejects.toThrow("Source inconnue")
})

describe("contraintes des passages", () => {
  it.each([
    { mode: "bootstrap" as const, windowStart: now },
    { deadlineAt: null },
    { targetCount: null },
    { deliveredCount: -1 },
    { mode: "daily" as const },
    { runKey: "daily:2026-10-24" },
    { status: "completed" as const },
    { finishedAt: now },
  ])("refuse une combinaison incohérente %j", async (patch) => {
    await expect(
      db.insert(scanRuns).values({
        mode: "bootstrap",
        runKey: "bootstrap",
        trigger: "admin",
        startedAt: now,
        deadlineAt: new Date(+now + 21600_000),
        targetCount: 50,
        ...patch,
      }),
    ).rejects.toThrow()
  })
  it("un quotidien ne peut porter ni échéance ni seuil", async () => {
    await expect(
      db.insert(scanRuns).values({
        mode: "daily",
        runKey: "daily:2026-10-24",
        trigger: "cron",
        startedAt: now,
        windowStart: now,
        targetReachedAt: now,
      }),
    ).rejects.toThrow()
  })
})
