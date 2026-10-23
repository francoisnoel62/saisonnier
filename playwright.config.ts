import { defineConfig, devices } from "@playwright/test"

import {
  E2E_PORT,
  E2E_URL,
  SCAN_FIXTURE_PORT,
  serverEnv,
} from "./e2e/helpers/env"

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Une seule base partagée : les fichiers s'exécutent l'un après l'autre.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: [
    {
      command: "npx tsx scripts/scan-fixture-server.ts",
      url: `http://localhost:${SCAN_FIXTURE_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { SCAN_FIXTURE_PORT: String(SCAN_FIXTURE_PORT) },
    },
    {
      command: `npx next dev -p ${E2E_PORT}`,
      url: E2E_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv(),
    },
  ],
})
