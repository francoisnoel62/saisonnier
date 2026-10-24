import { expect, it } from "vitest"

import { finalRunStatus } from "./run"
import { scanRunSourceStatuses } from "./vocabulary"

it("un arrêt demandé prime sur la couverture et les erreurs", () => {
  expect(finalRunStatus([{ status: "failed" }], { stopRequested: true })).toBe(
    "stopped",
  )
})
it.each(scanRunSourceStatuses)(
  "couverture finale d'une source %s",
  (status) => {
    expect(
      finalRunStatus([{ status: "done" }, { status }], {
        stopRequested: false,
      }),
    ).toBe(status === "done" ? "completed" : "partial")
  },
)
