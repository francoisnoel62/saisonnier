import { expect, test as setup } from "@playwright/test"

import { accounts, PASSWORD, roles, storageStatePath } from "./accounts"
import { insertVerifiedMembership } from "./helpers/company"
import { createDb, verifyAccount } from "./helpers/db"
import { signIn } from "./helpers/sign-in"

// Un compte par rôle : inscription par l'API, vérification et rôle en SQL, connexion par l'interface.
// La session est enregistrée pour les fixtures (asCandidate, asEmployer, asAdmin).
// L'employeur partagé est déjà rattaché à une entreprise vérifiée : son espace lui est ouvert.
for (const role of roles) {
  setup(`session ${role}`, async ({ page, request }) => {
    const { name, email } = accounts[role]

    const signUp = await request.post("/api/auth/sign-up/email", {
      data: { name, email, password: PASSWORD },
    })
    expect(signUp.ok()).toBe(true)

    const db = createDb()
    try {
      await verifyAccount(db, email, role)
      if (role === "employer") await insertVerifiedMembership(db, email)
    } finally {
      await db.end()
    }

    await signIn(page, role)
    await page.context().storageState({ path: storageStatePath(role) })
  })
}
