import { expect, test } from "./fixtures"
import { seedDemoCatalog, type DemoCatalog } from "./helpers/catalog"
import { expectNoHorizontalScroll, isMobileViewport } from "./helpers/shell"

let catalog: DemoCatalog
test.beforeAll(async ({ db }) => {
  catalog = await seedDemoCatalog(db)
})

test("les trois affichages conservent la recherche, la pagination et le retour de fiche", async ({
  asCandidate: page,
}) => {
  await page.goto("/offres?dept=73", { waitUntil: "networkidle" })
  const before = await page.locator("#resultats-nombre").textContent()
  await page.getByRole("button", { name: "Comparateur", exact: true }).click()
  await expect(page).toHaveURL(/vue=comparateur/)
  await expect(page).toHaveURL(/dept=73/)
  await expect(page.locator("#resultats-nombre")).toHaveText(before!)
  await expectNoHorizontalScroll(page)
  const first = page.locator("#resultats h3 a").first()
  await first.click()
  await page
    .getByRole("link", { name: "Retour aux offres", exact: true })
    .click()
  await expect(page).toHaveURL(/vue=comparateur/)
  await expect(page).toHaveURL(/dept=73/)
  await page.goto("/offres?vue=comparateur", { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Page suivante", exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page).toHaveURL(/vue=comparateur/)
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Comparateur", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
})

test("Immersion respecte les droits de candidature et se ferme au clavier sur mobile", async ({
  newCandidate,
}) => {
  const offer = catalog.offers.find(
    (o) => o.title === "Réceptionniste de nuit",
  )!
  const { page } = await newCandidate("immersion")
  const path = `/offres?vue=immersion&dept=73&offre=${offer.id}`
  await page.goto(path, { waitUntil: "networkidle" })
  const panel = isMobileViewport(page)
    ? page.getByRole("dialog", { name: "Détail de l’offre", exact: true })
    : page.getByRole("region", {
        name: "Détail de l’offre sélectionnée",
        exact: true,
      })
  await expect(
    panel.getByRole("heading", { name: offer.title, exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole("link", { name: "Compléter mon dossier", exact: true }),
  ).toBeVisible()
  for (const html of [
    await page.content(),
    await (await page.request.get(path)).text(),
  ]) {
    expect(html).not.toContain(offer.applyEmail!)
    expect(html).not.toContain(offer.applyPhone!)
    expect(html).not.toContain("mailto:")
    expect(html).not.toContain("tel:")
  }
  if (isMobileViewport(page)) {
    await page.keyboard.press("Escape")
    await expect(panel).not.toBeVisible()
    await expect(page).not.toHaveURL(/offre=/)
    await expect(
      page.getByRole("link", { name: offer.title, exact: true }),
    ).toBeFocused()
  }
  await expectNoHorizontalScroll(page)
})

test("la fiche réunit la candidature et rend les rubriques inconnues consultables", async ({
  asCandidate: page,
}) => {
  const offer = catalog.offers.find((o) => o.title === "Skiman")!
  await page.goto(`/offres/${offer.id}`)
  await expect(
    page.getByRole("heading", { name: "Candidater", exact: true }),
  ).toHaveCount(1)
  await expect(
    page.getByRole("heading", { name: "Comment postuler", exact: true }),
  ).toHaveCount(1)
  const profile = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: "Profil", exact: true }) })
  await profile.locator("summary").click()
  await expect(
    profile.getByText("Permis de conduire exigé", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: /Vous êtes l’employeur/ }),
  ).toBeVisible()
  await expectNoHorizontalScroll(page)
})
