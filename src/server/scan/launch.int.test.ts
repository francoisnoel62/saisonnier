import { eq } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  revalidatePath: vi.fn(),
}))
// Le route handler démarre le workflow par `start` : simulé ici, comme l'horloge.
vi.mock("workflow/api", () => ({
  start: mocks.start,
  getRun: () => ({
    exists: Promise.resolve(false),
    status: Promise.resolve("failed"),
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  enableScanSource,
  insertScanRun,
  resetScan,
} from "../../../e2e/helpers/scan"
import { db } from "@/lib/db"
import { scanRuns, scheduledJobs, user } from "@/lib/db/schema"
import { GET } from "@/app/api/cron/scan/route"
import { env } from "@/lib/env"

import { withRunClaim } from "./claim"
import { launchBootstrap, resumeRun, type Orchestrator } from "./launch"
import { requestStop } from "./runs"

const cron = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/scan", {
      headers: authorization ? { authorization } : {},
    }),
  )
const authorized = () => cron(`Bearer ${env.CRON_SECRET}`)
// 3 h 30 à Paris en hiver.
const slot = new Date("2026-12-01T02:30:00Z")
let admin: string

beforeEach(async () => {
  await resetScan(db.$client)
  await db.delete(scheduledJobs).where(eq(scheduledJobs.name, "scan"))
  mocks.start.mockReset()
  mocks.start.mockImplementation(async () => ({
    runId: `wrun_${crypto.randomUUID().replaceAll("-", "")}`,
  }))
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(slot)
  admin = `scan-launch-${crypto.randomUUID()}`
  await db.insert(user).values({
    id: admin,
    name: "Admin test",
    email: `${admin}@test.example`,
    role: "admin",
  })
})
afterEach(async () => {
  vi.useRealTimers()
  await db.delete(scheduledJobs).where(eq(scheduledJobs.name, "scan"))
  await resetScan(db.$client)
  await db.delete(user).where(eq(user.id, admin))
})
afterAll(() => resetScan(db.$client))

async function enableTask() {
  await db.insert(scheduledJobs).values({ name: "scan", enabled: true })
}
const runs = () => db.select().from(scanRuns)

describe("Scan §3 — route du scan quotidien", () => {
  it("secret absent ou faux : 401, rien n'est enregistré", async () => {
    expect((await cron()).status).toBe(401)
    expect((await cron("Bearer faux")).status).toBe(401)
    expect(await runs()).toHaveLength(0)
  })

  it("hors créneau (4 h 30 à Paris) : rien n'est enregistré", async () => {
    vi.setSystemTime(new Date("2026-12-01T03:30:00Z"))
    await enableTask()
    expect(await (await authorized()).json()).toMatchObject({
      skipped: "outside_slot",
    })
    expect(await runs()).toHaveLength(0)
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it("tâche désactivée par défaut : rien ne démarre", async () => {
    await enableScanSource(db.$client, "belambra", { daily: true })
    expect(await (await authorized()).json()).toMatchObject({
      skipped: "disabled",
    })
    expect(await runs()).toHaveLength(0)
  })

  it("aucune source en passages quotidiens : aucun passage", async () => {
    await enableTask()
    await enableScanSource(db.$client, "belambra", { daily: false })
    expect(await (await authorized()).json()).toMatchObject({
      outcome: "no_source",
    })
    expect(await runs()).toHaveLength(0)
  })

  it("premier créneau : un passage et un run ; second créneau du jour : déjà lancé", async () => {
    await enableTask()
    await enableScanSource(db.$client, "belambra", { daily: true })
    const first = await (await authorized()).json()
    expect(first).toMatchObject({ date: "2026-12-01", outcome: "started" })
    expect(mocks.start).toHaveBeenCalledTimes(1)
    const [run] = await runs()
    expect(run).toMatchObject({
      mode: "daily",
      runKey: "daily:2026-12-01",
      trigger: "cron",
    })
    expect(run.workflowRunId).toMatch(/^wrun_/)
    expect(await (await authorized()).json()).toMatchObject({
      outcome: "already_started",
      runId: run.id,
    })
    expect(mocks.start).toHaveBeenCalledTimes(1)
  })

  it("passage actif (remplissage initial) : run_in_progress, rien ne démarre", async () => {
    await enableTask()
    await enableScanSource(db.$client, "belambra", { daily: true })
    await insertScanRun(db.$client, { status: "running" })
    expect(await (await authorized()).json()).toMatchObject({
      outcome: "run_in_progress",
    })
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it("démarrage échoué : le passage reste visible, relancé au créneau suivant après 10 minutes", async () => {
    await enableTask()
    await enableScanSource(db.$client, "belambra", { daily: true })
    mocks.start.mockRejectedValueOnce(new Error("Workflow indisponible"))
    expect(await (await authorized()).json()).toMatchObject({
      outcome: "start_failed",
    })
    const [failed] = await runs()
    expect(failed).toMatchObject({ status: "queued", workflowRunId: null })
    vi.setSystemTime(new Date(+slot + 11 * 60_000))
    expect(await (await authorized()).json()).toMatchObject({
      outcome: "resumed",
      runId: failed.id,
    })
    const [resumed] = await runs()
    expect(resumed.claimToken).not.toBe(failed.claimToken)
    expect(resumed.workflowRunId).toMatch(/^wrun_/)
  })
})

describe("lancement et reprise par l'admin", () => {
  const orchestrator: Orchestrator = {
    start: (...args) => mocks.start(...args),
    status: async () => null,
  }

  it("aucune source activée : rien n'est créé", async () => {
    expect(await launchBootstrap(admin, { orchestrator })).toEqual({
      ok: false,
      reason: "no_source",
    })
    expect(await runs()).toHaveLength(0)
  })

  it("deux lancements simultanés : un seul passage, un seul start (SH3)", async () => {
    await enableScanSource(db.$client, "belambra")
    const results = await Promise.all([
      launchBootstrap(admin, { orchestrator }),
      launchBootstrap(admin, { orchestrator }),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(await runs()).toHaveLength(1)
    const [run] = await runs()
    expect(results).toContainEqual({
      ok: false,
      reason: "already_exists",
      runId: run.id,
    })
  })

  it("reprise après un arrêt : nouveau jeton, l'ancien n'écrit plus ; échéance conservée", async () => {
    await enableScanSource(db.$client, "belambra")
    const launched = await launchBootstrap(admin, { orchestrator })
    if (!launched.ok) throw new Error("lancement refusé")
    const [before] = await runs()
    await requestStop(before.id, new Date())
    await db
      .update(scanRuns)
      .set({ status: "stopped", finishedAt: new Date() })
      .where(eq(scanRuns.id, before.id))
    expect(await resumeRun(before.id, { orchestrator })).toEqual({
      ok: true,
      runId: before.id,
    })
    const [after] = await runs()
    expect(after.claimToken).not.toBe(before.claimToken)
    expect(after.deadlineAt).toEqual(before.deadlineAt)
    expect(after.status).toBe("queued")
    expect(
      await withRunClaim(before.id, before.claimToken, async () => ({
        ok: true,
      })),
    ).toEqual({ ok: false, reason: "superseded" })
    expect(mocks.start).toHaveBeenLastCalledWith(before.id, after.claimToken)
  })

  it("passage actif qui progresse : la reprise est refusée", async () => {
    await enableScanSource(db.$client, "belambra")
    await launchBootstrap(admin, {
      orchestrator: { ...orchestrator, status: async () => "running" },
    })
    const [run] = await runs()
    await db
      .update(scanRuns)
      .set({ status: "running", lastProgressAt: new Date() })
      .where(eq(scanRuns.id, run.id))
    expect(
      await resumeRun(run.id, {
        orchestrator: { ...orchestrator, status: async () => "running" },
      }),
    ).toMatchObject({ ok: false, reason: "orchestration_active" })
  })
})
