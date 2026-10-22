import { randomUUID } from "node:crypto"

import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from "@playwright/test"
import type { Pool } from "pg"

import { PASSWORD, storageStatePath, type TestRole } from "./accounts"
import { createDb, verifyAccount } from "./helpers/db"

type NewAccount = { page: Page; name: string; email: string }
type NewAccountFixture = (label?: string) => Promise<NewAccount>

type RolePages = {
  asCandidate: Page
  asEmployer: Page
  asAdmin: Page
  // Un candidat créé pour le test, connecté, sans dossier : les comptes partagés restent intacts.
  newCandidate: NewAccountFixture
  // Un employeur créé pour le test, connecté, sans entreprise rattachée.
  newEmployer: NewAccountFixture
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

const accountLabels = {
  candidate: { label: "candidat", name: "Candidat" },
  employer: { label: "employeur", name: "Employeur" },
} as const

// Fournit une fonction qui crée un compte du rôle, vérifié et connecté, dans son propre contexte.
function newAccount(role: keyof typeof accountLabels) {
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
      db,
    }: {
      browser: Browser
      baseURL: string | undefined
      viewport: { width: number; height: number } | null
      isMobile: boolean
      hasTouch: boolean
      deviceScaleFactor: number | undefined
      userAgent: string | undefined
      locale: string | undefined
      db: Pool
    },
    use: (create: NewAccountFixture) => Promise<void>,
    testInfo: TestInfo,
  ) => {
    const contexts: BrowserContext[] = []
    await use(async (label = accountLabels[role].label) => {
      // Les deux projets partagent la base : une adresse unique par appel.
      const email = `${label}-${testInfo.project.name}-${randomUUID().slice(0, 8)}@e2e.test`
      const name = `${accountLabels[role].name} ${label}`
      const options: BrowserContextOptions = {
        baseURL,
        viewport,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        userAgent,
        locale,
      }
      const context = await browser.newContext(options)
      contexts.push(context)

      const signUp = await context.request.post("/api/auth/sign-up/email", {
        data: { name, email, password: PASSWORD },
      })
      expect(signUp.ok()).toBe(true)
      await verifyAccount(db, email, role)
      const signIn = await context.request.post("/api/auth/sign-in/email", {
        data: { email, password: PASSWORD },
      })
      expect(signIn.ok()).toBe(true)

      return { page: await context.newPage(), name, email }
    })
    for (const context of contexts) await context.close()
  }
}

export const test = base.extend<RolePages, WorkerFixtures>({
  asCandidate: pageAs("candidate"),
  asEmployer: pageAs("employer"),
  asAdmin: pageAs("admin"),
  newCandidate: newAccount("candidate"),
  newEmployer: newAccount("employer"),
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

export { expect }
