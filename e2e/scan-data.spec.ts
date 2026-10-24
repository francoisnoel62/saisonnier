import { expect, test } from "./fixtures"
import { resetScan } from "./helpers/scan"
import { expectNoHorizontalScroll } from "./helpers/shell"

test("Scan — sources désactivées par défaut, réglages indépendants et persistants", async ({
  asAdmin,
  db,
}) => {
  await resetScan(db)
  try {
    await asAdmin.setViewportSize({ width: 375, height: 812 })
    await asAdmin.goto("/admin/scan")
    const source = asAdmin
      .locator("li")
      .filter({
        has: asAdmin.getByRole("heading", {
          name: "Fixtures locales",
          exact: true,
        }),
      })
    const enabled = source.getByRole("switch", { name: "Activée", exact: true })
    const auto = source.getByRole("switch", {
      name: "Publication automatique (passages quotidiens)",
      exact: true,
    })
    await expect(enabled).not.toBeChecked()
    await expect(auto).not.toBeChecked()
    await expect(
      source.getByText(
        /Le remplissage initial ne publie jamais automatiquement/,
      ),
    ).toBeVisible()
    await enabled.click()
    await expect(enabled).toBeEnabled()
    await auto.click()
    await expect(auto).toBeEnabled()
    await asAdmin.reload()
    await expect(enabled).toBeChecked()
    await expect(auto).toBeChecked()
    await enabled.click()
    await expect(enabled).toBeEnabled()
    await asAdmin.reload()
    await expect(enabled).not.toBeChecked()
    await expect(auto).toBeChecked()
    await expectNoHorizontalScroll(asAdmin)
  } finally {
    await resetScan(db)
  }
})
