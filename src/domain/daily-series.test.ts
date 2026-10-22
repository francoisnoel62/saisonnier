import { describe, expect, it } from "vitest"

import { dailySeries, lastDays } from "./daily-series"

describe("lastDays", () => {
  it("donne les derniers jours, aujourd'hui compris, du plus ancien au plus récent", () => {
    expect(lastDays("2026-03-02", 3)).toEqual([
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ])
    expect(lastDays("2026-10-22", 90)).toHaveLength(90)
    expect(lastDays("2026-10-22", 90)[0]).toBe("2026-07-25")
  })

  it("ne saute ni ne double aucun jour au changement d'heure", () => {
    expect(lastDays("2026-10-26", 3)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ])
  })
})

describe("dailySeries", () => {
  it("met un point par jour et par série, 0 les jours sans événement", () => {
    expect(
      dailySeries(["2026-10-20", "2026-10-21", "2026-10-22"], {
        candidates: [{ day: "2026-10-21", value: 3 }],
        offers: [
          { day: "2026-10-20", value: 1 },
          { day: "2026-10-22", value: 2 },
          // Hors période : ignoré.
          { day: "2026-10-01", value: 9 },
        ],
      }),
    ).toEqual([
      { date: "2026-10-20", candidates: 0, offers: 1 },
      { date: "2026-10-21", candidates: 3, offers: 0 },
      { date: "2026-10-22", candidates: 0, offers: 2 },
    ])
  })
})
