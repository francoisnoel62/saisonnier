import { expect, type Page } from "@playwright/test"

import { accounts, homePaths, PASSWORD, type TestRole } from "../accounts"

// Connexion par l'interface. En CI, `next dev` compile chaque page à sa première visite :
// on attend que le formulaire soit hydraté (avant, le clic ne fait rien), puis on laisse le
// temps de compiler /apres-connexion et l'accueil du rôle.
export async function signIn(page: Page, role: TestRole) {
  await page.goto("/connexion", { waitUntil: "networkidle" })
  await page.getByLabel("Adresse email").fill(accounts[role].email)
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(homePaths[role], { timeout: 30_000 })
}
