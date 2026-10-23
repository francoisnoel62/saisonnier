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
  await expect(
    asAdmin.getByRole("button", {
      name: /Tester l’accès depuis ce déploiement/,
    }),
  ).toHaveCount(5)
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
