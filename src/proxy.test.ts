import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { expect, it } from "vitest"

import { config } from "./proxy"

// Vercel Workflow rappelle l'application sur /.well-known/workflow/ : le proxy (liste blanche)
// ne doit jamais s'y interposer (plan scan 09).
it.each([
  ["/.well-known/workflow/v1/flow", false],
  ["/.well-known/workflow/v1/step", false],
  ["/.well-known/workflow/v1/webhook/jeton", false],
  ["/api/cron/scan", false],
  ["/admin/scan", true],
])("proxy sur %s : %s", (url, expected) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected)
})
