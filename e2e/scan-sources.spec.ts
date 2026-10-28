import { expect, test } from "./fixtures"
import { expectNoHorizontalScroll } from "./helpers/shell"

test("Scan — la page du scan est réservée à l'admin", async ({
  asCandidate,
  asEmployer,
}) => {
  await asCandidate.goto("/admin/scan")
  await expect(asCandidate).toHaveURL("/offres")
  await asEmployer.goto("/admin/scan")
  await expect(asEmployer).toHaveURL("/employeur")
})

test("Scan — sources et navigation accessibles à l'admin sur mobile", async ({
  asAdmin,
}) => {
  await asAdmin.setViewportSize({ width: 375, height: 812 })
  await asAdmin.goto("/admin/scan")
  await expect(
    asAdmin.getByRole("heading", { level: 1, name: "Scan", exact: true }),
  ).toBeVisible()
  await expect(
    asAdmin.getByRole("heading", { name: "Sources du scan" }),
  ).toBeVisible()
  const firstSource = asAdmin
    .locator("[data-slot='card-content'] > ul > li")
    .first()
  await expect(
    firstSource.getByRole("heading", { name: "France Travail" }),
  ).toBeVisible()
  await expect(firstSource.getByText("Principale · Découverte")).toBeVisible()
  await expect(
    firstSource.getByText(/source officielle de l’employeur/),
  ).toBeVisible()
  await expect(firstSource.getByText("Prête", { exact: true })).toBeVisible()
  // Sources testables : France Travail, les trois réserves et les fixtures ; les trois pistes
  // écartées du plan 01 s'affichent sans bouton de test.
  await expect(
    asAdmin.getByRole("button", {
      name: /Tester l’accès depuis ce déploiement/,
    }),
  ).toHaveCount(5)
  const sandaya = asAdmin.locator("li").filter({
    has: asAdmin.getByRole("heading", { name: "Sandaya (WeRecruit)" }),
  })
  await expect(sandaya.getByText("Écartée", { exact: true })).toBeVisible()
  await expect(sandaya.getByRole("button")).toHaveCount(0)
  // Une réserve non qualifiée ne s'active pas et dit pourquoi.
  const belambra = asAdmin.locator("li").filter({
    has: asAdmin.getByRole("heading", { name: "Belambra", exact: true }),
  })
  const enabled = belambra.getByRole("switch", { name: "Activée", exact: true })
  await expect(enabled).toBeDisabled()
  await expect(enabled).toHaveAccessibleDescription(/À qualifier/)
  await expectNoHorizontalScroll(asAdmin)
})

test("Scan — la sonde affiche la liste et trois fiches dans un panneau accessible", async ({
  asAdmin,
}) => {
  await asAdmin.setViewportSize({ width: 375, height: 812 })
  await asAdmin.goto("/admin/scan")
  const trigger = asAdmin.getByRole("button", {
    name: /Tester l’accès depuis ce déploiement.*Fixtures locales/,
  })
  await trigger.click()
  const sheet = asAdmin.getByRole("dialog", {
    name: "Diagnostic — Fixtures locales",
  })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText("Lecture de la source en cours…")).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Liste — Accessible" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    sheet.getByRole("heading", { name: "Fiche — Accessible" }),
  ).toHaveCount(3)
  await expect(sheet.getByText(/robots.txt : autorisé/)).toHaveCount(4)
  await expectNoHorizontalScroll(asAdmin)
  await asAdmin.keyboard.press("Escape")
  await expect(sheet).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test("Scan — l'échantillon affiche les champs établis sans créer de dossier", async ({
  asAdmin,
  db,
}) => {
  const before = await db.query<{ count: string }>(
    "select count(*) from scan_candidates",
  )
  await asAdmin.goto("/admin/scan")
  await asAdmin
    .getByRole("button", { name: /Extraire un échantillon.*Fixtures locales/ })
    .click()
  const sheet = asAdmin.getByRole("dialog", {
    name: "Échantillon — Fixtures locales",
  })
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Champs établis dans l’échantillon" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(sheet.getByText("Contrat : 3/3", { exact: true })).toBeVisible()
  await expect(sheet.getByRole("link", { name: "Fiche source" })).toHaveCount(3)
  await expectNoHorizontalScroll(asAdmin)
  const after = await db.query<{ count: string }>(
    "select count(*) from scan_candidates",
  )
  expect(after.rows[0].count).toBe(before.rows[0].count)
})
