import { describe, expect, it } from "vitest"

import { scheduledJobDefinitions, jobEnabledByDefault } from "../scheduled-job"
import {
  canStartPosting,
  orchestrationLost,
  orchestrationStallMs,
  planDomains,
} from "./orchestration"
import { finalRunStatus } from "./run"
import { formatDuration, runProgress } from "./run-progress"
import { isDailyScanSlot } from "./schedule"

describe("créneau du scan quotidien (SH11)", () => {
  it.each([
    ["2026-07-01T01:30:00Z", "3 h 30 (été)", true],
    ["2026-07-01T02:30:00Z", "4 h 30", false],
    ["2026-12-01T01:30:00Z", "2 h 30 (hiver)", false],
    ["2026-12-01T02:30:00Z", "3 h 30", true],
    ["2026-10-25T01:30:00Z", "2 h 30 (passage à l'heure d'hiver)", false],
    ["2026-10-25T02:30:00Z", "3 h 30", true],
    ["2027-03-28T01:30:00Z", "3 h 30 (passage à l'heure d'été)", true],
    ["2027-03-28T02:30:00Z", "4 h 30", false],
  ])("%s, %s à Paris : %s", (instant, _paris, slot) => {
    expect(isDailyScanSlot(new Date(instant))).toBe(slot)
  })
})

describe("planDomains", () => {
  it("une requête à la fois par domaine, trois domaines par vague, ordre conservé", () => {
    expect(
      planDomains([
        { key: "a", host: "A.example" },
        { key: "b", host: "b.example" },
        { key: "a2", host: "a.example" },
        { key: "c", host: "c.example" },
        { key: "d", host: "d.example" },
      ]),
    ).toEqual([
      [
        { host: "a.example", sources: ["a", "a2"] },
        { host: "b.example", sources: ["b"] },
        { host: "c.example", sources: ["c"] },
      ],
      [{ host: "d.example", sources: ["d"] }],
    ])
    expect(planDomains([])).toEqual([])
  })
})

describe("budget d'un lot", () => {
  it("une fiche ne commence que si elle peut finir dans les 120 s", () => {
    expect(canStartPosting(0, 0)).toBe(true)
    expect(canStartPosting(0, 90_000)).toBe(true)
    expect(canStartPosting(0, 90_001)).toBe(false)
  })
})

describe("finalRunStatus", () => {
  it("terminé, partiel ou arrêté", () => {
    expect(finalRunStatus([{ status: "done" }], { stopRequested: false })).toBe(
      "completed",
    )
    expect(
      finalRunStatus([{ status: "done" }, { status: "blocked" }], {
        stopRequested: false,
      }),
    ).toBe("partial")
    expect(finalRunStatus([{ status: "done" }], { stopRequested: true })).toBe(
      "stopped",
    )
  })
})

describe("orchestrationLost", () => {
  const now = new Date("2026-10-28T10:00:00Z")
  const run = {
    status: "running" as const,
    workflowRunId: "wrun_1",
    lastProgressAt: new Date(+now - 60_000),
    startedAt: new Date("2026-10-28T09:00:00Z"),
  }
  it("actif et récent : non perdu ; workflow terminé ou silence de 15 min : perdu", () => {
    expect(orchestrationLost(run, "running", now)).toBe(false)
    expect(orchestrationLost(run, "failed", now)).toBe(true)
    expect(orchestrationLost(run, null, now)).toBe(true)
    expect(
      orchestrationLost(
        { ...run, lastProgressAt: new Date(+now - orchestrationStallMs - 1) },
        "running",
        now,
      ),
    ).toBe(true)
  })
  it("sans workflow : relance après le délai de grâce ; terminé : sans objet", () => {
    const unstarted = { ...run, status: "queued" as const, workflowRunId: null }
    expect(
      orchestrationLost(unstarted, null, now, { unstartedMs: 120_000 }),
    ).toBe(false)
    expect(
      orchestrationLost(unstarted, null, now, { unstartedMs: 30_000 }),
    ).toBe(true)
    expect(orchestrationLost({ ...run, status: "partial" }, null, now)).toBe(
      false,
    )
  })
})

describe("tâche planifiée du scan", () => {
  it("désactivée par défaut, la tâche quotidienne reste active", () => {
    expect(jobEnabledByDefault("scan")).toBe(false)
    expect(jobEnabledByDefault("daily")).toBe(true)
    expect(
      scheduledJobDefinitions.scan.summaryLabel({
        date: "2026-10-28",
        outcome: "run_in_progress",
        runId: null,
      }),
    ).toBe("Un autre passage était en cours : rien n'a démarré")
  })
})

describe("avancement d'un passage", () => {
  it("échéance, reste à livrer et seuil à T+…", () => {
    const progress = runProgress(
      {
        startedAt: "2026-10-28T08:00:00Z",
        deadlineAt: "2026-10-28T14:00:00Z",
        deliveredCount: 12,
        targetCount: 50,
        targetReachedAt: null,
        firstDeliveredAt: "2026-10-28T08:03:00Z",
      },
      new Date("2026-10-28T09:30:00Z"),
    )
    expect(progress).toEqual({
      remainingMs: 4.5 * 3_600_000,
      toDeliver: 38,
      reachedAfterMs: null,
      firstDeliveryAfterMs: 180_000,
    })
    expect(formatDuration(4.5 * 3_600_000)).toBe("4 h 30")
    expect(formatDuration(180_000)).toBe("3 min")
    expect(formatDuration(10_000)).toBe("moins d’une minute")
  })
})
