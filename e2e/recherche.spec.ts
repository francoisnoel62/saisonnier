import type { Page } from "@playwright/test"

import type { SearchCriteria } from "../src/domain/search-criteria"
import { expect, test } from "./fixtures"
import { seedDemoCatalog, type DemoCatalog } from "./helpers/catalog"
import { expectNoHorizontalScroll, isMobileViewport } from "./helpers/shell"

// Recherche des offres (plan 09) sur le jeu de démonstration. Chaque compteur attendu est calculé
// par l'oracle de la recherche (matchesCriteria) sur ce même jeu.

let catalog: DemoCatalog

test.beforeAll(async ({ db }) => {
  catalog = await seedDemoCatalog(db)
})

const resultsCount = (page: Page) => page.locator("#resultats-nombre")

async function expectCount(page: Page, criteria: SearchCriteria) {
  await expect(resultsCount(page)).toHaveText(catalog.countLabel(criteria))
}

// Le panneau « Tous les filtres » (bureau) ou « Filtres » (mobile) : mêmes contrôles partout.
async function openFilters(page: Page) {
  await page
    .getByRole("button", {
      name: isMobileViewport(page) ? /^Filtres/ : "Tous les filtres",
    })
    .click()
  const sheet = page.getByRole("dialog", { name: "Filtres" })
  await expect(sheet).toBeVisible()
  return sheet
}

// Le filtre ne s'hydrate qu'une fois la page chargée.
async function openSearch(page: Page, query = "") {
  await page.goto(`/offres${query}`, { waitUntil: "networkidle" })
}

const titles = (page: Page) => page.locator("#resultats h3").allTextContents()

test("§4 — trois filtres activés l'un après l'autre changent le compteur à chaque fois, sans bouton « valider »", async ({
  asCandidate: page,
}) => {
  const steps: SearchCriteria[] = [
    {},
    { housing: true },
    { housing: true, meals: true },
    { housing: true, meals: true, workTime: "full_time" },
  ]
  // Le jeu de démonstration doit faire varier le compteur à chaque étape.
  expect(
    new Set(steps.map((criteria) => catalog.countLabel(criteria))).size,
  ).toBe(steps.length)

  await openSearch(page)
  await expectCount(page, steps[0])

  const sheet = await openFilters(page)
  await sheet.getByRole("switch", { name: "Logement fourni" }).click()
  await expectCount(page, steps[1])
  await sheet.getByRole("switch", { name: "Repas fournis" }).click()
  await expectCount(page, steps[2])
  await sheet.getByRole("radio", { name: "Temps plein" }).click()
  await expectCount(page, steps[3])

  await expect(
    page.getByRole("button", { name: /valider|appliquer|rechercher/i }),
  ).toHaveCount(0)
  await expect(page).toHaveURL(/logement=oui/)
  await expect(page).toHaveURL(/repas=oui/)
  await expect(page).toHaveURL(/temps=plein/)
})

test("§4 — retirer un badge élargit les résultats et garde les autres critères", async ({
  asCandidate: page,
}) => {
  await openSearch(page, "?logement=oui&temps=plein")
  await expectCount(page, { housing: true, workTime: "full_time" })

  const active = page.getByRole("region", { name: "Critères actifs" })
  await active
    .getByRole("button", { name: "Retirer le critère « Logement fourni »" })
    .click()

  await expectCount(page, { workTime: "full_time" })
  expect(catalog.matching({ workTime: "full_time" }).length).toBeGreaterThan(
    catalog.matching({ housing: true, workTime: "full_time" }).length,
  )
  await expect(active.getByText("Temps plein")).toBeVisible()
  await expect(active.getByText("Logement fourni")).toHaveCount(0)
  await expect(page).not.toHaveURL(/logement=/)

  await active.getByRole("button", { name: "Tout effacer" }).click()
  await expectCount(page, {})
  await expect(active).toHaveCount(0)
})

test("§4 — après un rechargement, la recherche et ses résultats sont identiques", async ({
  asCandidate: page,
}) => {
  await openSearch(page)
  const sheet = await openFilters(page)
  await sheet.getByRole("switch", { name: "Débutants acceptés" }).click()
  await expectCount(page, { beginnersWelcome: true })
  await sheet.getByRole("checkbox", { name: "Anglais" }).click()
  const criteria: SearchCriteria = {
    beginnersWelcome: true,
    spokenLanguages: ["en"],
  }
  await expectCount(page, criteria)
  await page.keyboard.press("Escape")

  const before = await titles(page)
  expect(before).toHaveLength(catalog.matching(criteria).length)

  await page.reload({ waitUntil: "networkidle" })
  await expectCount(page, criteria)
  expect(await titles(page)).toEqual(before)
  const active = page.getByRole("region", { name: "Critères actifs" })
  await expect(active.getByText("Débutants acceptés")).toBeVisible()
  await expect(active.getByText("Je parle anglais")).toBeVisible()
})

test("§9 — le filtre « Logement fourni » n'affiche jamais une offre au logement « Non précisé »", async ({
  asCandidate: page,
}) => {
  const housingValues = page.locator("#resultats dt:has-text('Logement') + dd")

  await openSearch(page)
  // Sans filtre, le logement inconnu est affiché tel quel.
  await expect(
    housingValues.filter({ hasText: "Non précisé" }),
  ).not.toHaveCount(0)

  const sheet = await openFilters(page)
  await sheet.getByRole("switch", { name: "Logement fourni" }).click()
  await expectCount(page, { housing: true })
  await page.keyboard.press("Escape")

  const values = await housingValues.allTextContents()
  expect(values).toHaveLength(catalog.matching({ housing: true }).length)
  expect(new Set(values)).toEqual(new Set(["Oui"]))
})

test("§9 — le filtre net à 1 800 € n'affiche pas une offre brute à 2 000 €", async ({
  asCandidate: page,
}) => {
  const grossOffer = "Serveur / serveuse en restaurant d'altitude"
  const offer = catalog.offers.find((o) => o.title === grossOffer)
  expect(offer?.salaryGrossMinCents).toBe(200000)
  expect(offer?.salaryGrossUnit).toBe("month")
  expect(offer?.salaryNetMinCents).toBeUndefined()

  await openSearch(page)
  const sheet = await openFilters(page)
  const minimum = sheet.getByLabel("Salaire mensuel minimum (€)")
  await expect(minimum).toBeDisabled()

  await sheet.getByRole("radio", { name: "Net" }).click()
  await minimum.fill("1800")
  await expectCount(page, { salaryBasis: "net", salaryMinMonthly: 1800 })
  await expect(page).toHaveURL(/base=net&min=1800/)
  // Le panneau ouvert masque la liste aux lecteurs d'écran : on lit les titres directement.
  expect(await titles(page)).not.toContain(grossOffer)

  // Le même seuil en brut la retient : seule la base choisie est comparée.
  await sheet.getByRole("radio", { name: "Brut" }).click()
  await minimum.fill("2000")
  await expectCount(page, { salaryBasis: "gross", salaryMinMonthly: 2000 })
  expect(await titles(page)).toContain(grossOffer)
})

test("§4 — sur ordinateur, le métier se choisit dans une liste groupée par famille", async ({
  asCandidate: page,
}) => {
  test.skip(isMobileViewport(page), "barre de filtres réservée à l'ordinateur")

  await openSearch(page)
  await page.getByRole("button", { name: /^Métier/ }).click()
  await page.getByLabel("Rechercher un métier").fill("serveur")
  await expect(page.getByRole("group", { name: "Salle & bar" })).toBeVisible()
  await page.getByRole("option", { name: "Serveur / serveuse" }).click()

  await expectCount(page, { occupations: ["serveur"] })
  await expect(page).toHaveURL(/metier=serveur/)
  await expect(
    page.getByRole("button", { name: "Métier 1 actif" }),
  ).toBeVisible()
})

test.describe("mobile, 375 px", () => {
  test.use({ viewport: { width: 375, height: 740 } })

  test("§4 — le panneau des filtres annonce le bon nombre d'offres", async ({
    asCandidate: page,
  }) => {
    await openSearch(page)
    await expectNoHorizontalScroll(page)

    const sheet = await openFilters(page)
    await expectNoHorizontalScroll(page)
    await sheet.getByRole("switch", { name: "Couples acceptés" }).click()
    const showResults = sheet.getByRole("button", {
      name: `Voir ${catalog.countLabel({ couplesWelcome: true })}`,
    })
    await expect(showResults).toBeVisible()

    await showResults.click()
    await expect(sheet).toBeHidden()
    await expectCount(page, { couplesWelcome: true })
    await expect(
      page.getByRole("button", { name: "Filtres 1 actif" }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
