import { describe, expect, it } from "vitest"

import {
  dailyJobSummaryLabel,
  isScheduledJobName,
  scheduledJobDefinitions,
  scheduledJobNames,
  scheduledJobSummaryLabel,
} from "./scheduled-job"

describe("dailyJobSummaryLabel", () => {
  it("résume un passage de la tâche quotidienne", () => {
    expect(
      dailyJobSummaryLabel({
        date: "2026-10-23",
        expired: 2,
        reminders: { sent: 1, failed: 0 },
      }),
    ).toBe("2 annonces expirées, 1 rappel de validité envoyé")
    expect(
      dailyJobSummaryLabel({
        date: "2026-10-23",
        expired: 0,
        reminders: { sent: 3, failed: 1 },
      }),
    ).toBe("0 annonce expirée, 3 rappels de validité envoyés, 1 envoi en échec")
  })
})

describe("registre des tâches planifiées", () => {
  it("chaque tâche a un nom, un libellé, un horaire et un résumé", () => {
    expect(scheduledJobNames).toEqual(["daily"])
    for (const name of scheduledJobNames) {
      expect(scheduledJobDefinitions[name].label).not.toBe("")
      expect(scheduledJobDefinitions[name].schedule).not.toBe("")
    }
    expect(
      scheduledJobSummaryLabel("daily", {
        date: "2026-10-23",
        expired: 1,
        reminders: { sent: 0, failed: 0 },
      }),
    ).toBe("1 annonce expirée, 0 rappel de validité envoyé")
  })

  it("ne reconnaît que les tâches du registre", () => {
    expect(isScheduledJobName("daily")).toBe(true)
    expect(isScheduledJobName("hourly")).toBe(false)
    expect(isScheduledJobName(undefined)).toBe(false)
  })
})
