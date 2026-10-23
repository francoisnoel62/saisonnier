import { expect, it } from "vitest"

import { scanFailureLabels, scanFailureReasons, stopsSource } from "./http"

it("chaque motif d'échec a un libellé français", () => {
  for (const reason of scanFailureReasons)
    expect(scanFailureLabels[reason]).toMatch(/^[a-zà-ÿ]/)
})

it.each([
  "robots_disallowed",
  "access_denied",
  "rate_limited",
  "timeout",
  "network",
  "blocked_address",
] as const)("%s arrête la lecture de la source", (reason) => {
  expect(stopsSource(reason)).toBe(true)
})

it.each([
  "not_found",
  "gone",
  "too_large",
  "unsupported_type",
  "http_error",
] as const)("%s n'arrête pas les fiches suivantes", (reason) => {
  expect(stopsSource(reason)).toBe(false)
})
