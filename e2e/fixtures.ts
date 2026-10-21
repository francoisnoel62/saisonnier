import { test as base, type Browser, type Page } from "@playwright/test"
import type { Pool } from "pg"

import { storageStatePath, type TestRole } from "./accounts"
import { createDb } from "./helpers/db"

type RolePages = {
  asCandidate: Page
  asEmployer: Page
  asAdmin: Page
}

type WorkerFixtures = { db: Pool }

// Les options du projet (appareil, viewport, baseURL) ne s'appliquent pas aux contextes créés
// à la main : on les reprend ici pour que le projet « mobile » reste mobile.
// Fournit une page déjà connectée avec la session du rôle, dans son propre contexte.
function pageAs(role: TestRole) {
  return async (
    {
      browser,
      baseURL,
      viewport,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      userAgent,
      locale,
    }: {
      browser: Browser
      baseURL: string | undefined
      viewport: { width: number; height: number } | null
      isMobile: boolean
      hasTouch: boolean
      deviceScaleFactor: number | undefined
      userAgent: string | undefined
      locale: string | undefined
    },
    use: (page: Page) => Promise<void>,
  ) => {
    const context = await browser.newContext({
      baseURL,
      viewport,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      userAgent,
      locale,
      storageState: storageStatePath(role),
    })
    try {
      await use(await context.newPage())
    } finally {
      await context.close()
    }
  }
}

export const test = base.extend<RolePages, WorkerFixtures>({
  asCandidate: pageAs("candidate"),
  asEmployer: pageAs("employer"),
  asAdmin: pageAs("admin"),
  // Client SQL sur la base de test, pour préparer des données.
  db: [
    async ({}, use) => {
      const db = createDb()
      try {
        await use(db)
      } finally {
        await db.end()
      }
    },
    { scope: "worker" },
  ],
})

export { expect } from "@playwright/test"
