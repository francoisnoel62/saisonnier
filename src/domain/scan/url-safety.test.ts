import { expect, it } from "vitest"

import { checkScanUrl, type ScanUrlPolicy } from "./url-safety"

const production: ScanUrlPolicy = {
  environment: "production",
  testSourceUrl: "http://localhost:3210",
}
it.each([
  "http://example.com",
  "ftp://example.com",
  "https://example.com:8443",
  "https://user@example.com",
  "https://user:password@example.com",
  "http://localhost:3210",
  "https://localhost",
  "https://foo.localhost",
  "not a url",
])("URL interdite : %s", (url) =>
  expect(checkScanUrl(url, production)).toBeNull(),
)
it("accepte HTTPS sur le port par défaut", () => {
  expect(checkScanUrl("https://example.com:443/jobs", production)?.href).toBe(
    "https://example.com/jobs",
  )
})
it("l'exception ne porte que sur localhost et le port explicitement fournis", () => {
  for (const environment of ["test", "development"] as const) {
    const policy = { environment, testSourceUrl: "http://localhost:3210/list" }
    expect(checkScanUrl("http://localhost:3210/jobs/1", policy)).not.toBeNull()
    for (const url of [
      "http://localhost:3211",
      "http://127.0.0.1:3210",
      "http://other:3210",
      "http://user@localhost:3210",
    ])
      expect(checkScanUrl(url, policy)).toBeNull()
  }
  expect(
    checkScanUrl("http://localhost:3210", { environment: "test" }),
  ).toBeNull()
})
