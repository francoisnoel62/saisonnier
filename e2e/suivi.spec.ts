import { randomUUID } from "node:crypto"

import type { Page } from "@playwright/test"
import type { Pool } from "pg"

import { formatDate } from "../src/lib/format"
import { expect, test } from "./fixtures"
import { seedDemoCatalog, type DemoCatalog } from "./helpers/catalog"
import { completeDossier } from "./helpers/dossier"
import { insertCollectedOffer } from "./helpers/offers"

// Offres sauvegardées et « J'ai postulé » (plan 12) : une sauvegarde et une déclaration manuelle,
// rien de plus (§5).

let catalog: DemoCatalog

test.beforeAll(async ({ db }) => {
  catalog = await seedDemoCatalog(db)
})

async function trackingRows(db: Pool, email: string) {
  const { rows } = await db.query(
    `select t.offer_id, t.saved_at, t.applied_at
       from offer_tracking t join "user" u on u.id = t.user_id
      where u.email = $1`,
    [email],
  )
  return rows
}

const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name })

test("§5 — un clic sur un lien mailto: ou tel: ne crée aucune déclaration", async ({
  newCandidate,
  db,
}) => {
  const offer = catalog.offers.find(
    (o) => o.title === "Réceptionniste de nuit",
  )!
  const { page, email } = await newCandidate("suivi-contact")
  await completeDossier(page, "contact")
  await page.goto(`/offres/${offer.id}`, { waitUntil: "networkidle" })

  // Le navigateur n'ouvre ni messagerie ni téléphone ; les gestionnaires de la page, eux, s'exécutent.
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (event) => {
        const link = (event.target as Element).closest(
          'a[href^="mailto:"], a[href^="tel:"]',
        )
        if (link) event.preventDefault()
      },
      true,
    ),
  )
  await page.getByRole("link", { name: offer.applyEmail! }).click()
  await page.getByRole("link", { name: offer.applyPhone! }).click()

  await expect(page.getByRole("button", { name: "J’ai postulé" })).toBeVisible()
  expect(await trackingRows(db, email)).toEqual([])
  await page.goto("/mes-offres")
  await expect(tab(page, /^J’ai postulé \(0\)$/)).toBeVisible()
})

test("§5 — « J'ai postulé » fait apparaître l'offre dans l'onglet avec sa date ; « Annuler » la retire", async ({
  newCandidate,
}) => {
  const offer = catalog.offers.find((o) => o.title === "Commis de cuisine")!
  const { page } = await newCandidate("suivi-postule")
  await completeDossier(page, "postule")
  await page.goto(`/offres/${offer.id}`, { waitUntil: "networkidle" })

  const declared = `Vous avez indiqué avoir postulé le ${formatDate(new Date())}`
  await page.getByRole("button", { name: "J’ai postulé" }).click()
  await expect(page.getByText(declared)).toBeVisible()
  await page.reload()
  await expect(page.getByText(declared)).toBeVisible()

  await page.goto("/mes-offres", { waitUntil: "networkidle" })
  await expect(tab(page, /^Sauvegardées \(0\)$/)).toBeVisible()
  await tab(page, /^J’ai postulé \(1\)$/).click()
  const card = page.getByRole("tabpanel").getByRole("listitem")
  await expect(card).toHaveCount(1)
  await expect(card.getByRole("link", { name: offer.title })).toBeVisible()
  await expect(card.getByText(declared)).toBeVisible()

  await card
    .getByRole("button", { name: "Annuler la déclaration « J'ai postulé »" })
    .click()
  await expect(tab(page, /^J’ai postulé \(0\)$/)).toBeVisible()
  await expect(page.getByText("Aucune candidature déclarée")).toBeVisible()
})

test("§5 — une offre sauvegardée, puis expirée, affiche « Offre expirée » sans coordonnées", async ({
  newCandidate,
  db,
}) => {
  const title = `Offre suivie ${randomUUID().slice(0, 8)}`
  const offerId = await insertCollectedOffer(db, title)
  const { page, email } = await newCandidate("suivi-expire")

  // Sauvegarde depuis la carte de la recherche : le bouton change aussitôt d'état.
  await page.goto("/offres", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: `Sauvegarder « ${title} »` }).click()
  await expect(
    page.getByRole("button", {
      name: `Retirer « ${title} » des offres sauvegardées`,
    }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect.poll(async () => (await trackingRows(db, email)).length).toBe(1)

  // Date limite dépassée : l'offre n'est plus active.
  await db.query(
    "update offers set application_deadline = current_date - 2 where id = $1",
    [offerId],
  )
  await page.goto("/mes-offres")
  await expect(tab(page, /^Sauvegardées \(1\)$/)).toBeVisible()
  const card = page.getByRole("tabpanel").getByRole("listitem")
  await expect(card.getByText("Offre expirée")).toBeVisible()
  await expect(card.getByRole("link", { name: title })).toBeVisible()
  await expect(card.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(
    0,
  )

  await card.getByRole("link", { name: title }).click()
  await expect(page.getByText("Cette offre n’est plus active")).toBeVisible()
  await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(
    0,
  )

  // Retirer la sauvegarde vide la liste.
  await page.goto("/mes-offres", { waitUntil: "networkidle" })
  await page
    .getByRole("button", {
      name: `Retirer « ${title} » des offres sauvegardées`,
    })
    .click()
  await expect(tab(page, /^Sauvegardées \(0\)$/)).toBeVisible()
  expect(await trackingRows(db, email)).toEqual([])
})
