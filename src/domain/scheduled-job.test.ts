import { describe, expect, it } from "vitest"

import { dailyJobSummaryLabel } from "./scheduled-job"

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
