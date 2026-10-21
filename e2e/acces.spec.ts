import type { Page } from "@playwright/test"

import { navigation } from "../src/config/navigation"
import { roles, homePaths, type TestRole } from "./accounts"
import { expect, test } from "./fixtures"
import { navLink, openMenu } from "./helpers/shell"

async function expectOwnNavigationOnly(page: Page, role: TestRole) {
  await page.goto(homePaths[role])
  await openMenu(page)

  const own = navigation[role]
  for (const item of own) {
    await expect(navLink(page, item.title)).toBeInViewport()
  }
  await expect(navLink(page, "Mon compte")).toBeInViewport()

  // Aucune entrée d'un autre rôle (« Tableau de bord » ou « Voir le catalogue » existent
  // chez plusieurs rôles : on ne compare que les titres que le rôle n'a pas).
  const ownTitles = new Set(own.map((item) => item.title))
  for (const other of roles.filter((r) => r !== role)) {
    for (const item of navigation[other]) {
      if (!ownTitles.has(item.title)) {
        await expect(navLink(page, item.title)).toHaveCount(0)
      }
    }
  }
}

test("accès — un visiteur anonyme sur /offres est renvoyé vers la connexion", async ({
  page,
}) => {
  await page.goto("/offres")
  await expect(page).toHaveURL(/\/connexion\?next=%2Foffres$/)
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible()
})

test("accès — un candidat n'accède ni à /employeur ni à /admin", async ({
  asCandidate,
}) => {
  for (const path of [
    "/employeur",
    "/employeur/annonces",
    "/admin",
    "/admin/annonces",
  ]) {
    await asCandidate.goto(path)
    await expect(asCandidate).toHaveURL(homePaths.candidate)
  }
})

test("accès — un employeur n'accède ni à /admin ni aux pages candidat", async ({
  asEmployer,
}) => {
  for (const path of [
    "/admin",
    "/admin/verifications",
    "/dossier",
    "/mes-offres",
  ]) {
    await asEmployer.goto(path)
    await expect(asEmployer).toHaveURL(homePaths.employer)
  }
})

test("accès — un administrateur n'accède pas à l'espace employeur", async ({
  asAdmin,
}) => {
  await asAdmin.goto("/employeur/entreprise")
  await expect(asAdmin).toHaveURL(homePaths.admin)
})

test("navigation — le candidat ne voit que sa navigation", async ({
  asCandidate,
}) => {
  await expectOwnNavigationOnly(asCandidate, "candidate")
})

test("navigation — l'employeur ne voit que sa navigation", async ({
  asEmployer,
}) => {
  await expectOwnNavigationOnly(asEmployer, "employer")
})

test("navigation — l'administrateur ne voit que sa navigation", async ({
  asAdmin,
}) => {
  await expectOwnNavigationOnly(asAdmin, "admin")
})
