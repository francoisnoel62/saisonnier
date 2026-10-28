import { expect, it } from "vitest"
import { start } from "workflow/api"

import { scanSmokeWorkflow } from "./smoke"

it("diagnostic : deux étapes, une attente, la base est atteinte", async () => {
  const run = await start(scanSmokeWorkflow, ["2026-10-28T00:00:00.000Z"])
  const result = await run.returnValue
  expect(await run.status).toBe("completed")
  expect(result.requestedAt).toBe("2026-10-28T00:00:00.000Z")
  expect(Date.parse(result.database)).not.toBeNaN()
})
