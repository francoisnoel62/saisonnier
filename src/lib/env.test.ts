import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it("refuse SCAN_TEST_SOURCE_URL en production (preview comprise)", async () => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("SCAN_TEST_SOURCE_URL", "http://localhost:3210")
  vi.resetModules()
  await expect(import("./env")).rejects.toThrow(
    "Interdit en preview et en production",
  )
})
it("autorise seulement le serveur localhost explicite en test", async () => {
  vi.stubEnv("SCAN_TEST_SOURCE_URL", "http://localhost:3210/list")
  vi.resetModules()
  expect((await import("./env")).env.SCAN_TEST_SOURCE_URL).toBe(
    "http://localhost:3210/list",
  )
})
it.each([
  "https://localhost:3210",
  "http://127.0.0.1:3210",
  "http://private.example",
  "http://user@localhost:3210",
])("refuse une exception locale mal définie : %s", async (url) => {
  vi.stubEnv("SCAN_TEST_SOURCE_URL", url)
  vi.resetModules()
  await expect(import("./env")).rejects.toThrow("Utiliser uniquement")
})
