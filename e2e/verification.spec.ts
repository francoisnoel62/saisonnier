import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { insertPendingOffer, randomSiren } from "./helpers/company"
import { expectEmail } from "./helpers/outbox"

const PENDING_BANNER =
  "Votre rattachement est en cours de vérification. Vos annonces seront publiées après validation."

// Onboarding par la saisie manuelle de l'entreprise (sans l'API Recherche d'entreprises).
async function onboard(
  page: Page,
  company: { legalName: string; siren: string },
  relationship: { option: string; details?: string },
) {
  await page.goto("/employeur")
  await expect(page).toHaveURL("/employeur/entreprise")
  await page.waitForLoadState("networkidle")

  await page.getByLabel("Raison sociale").fill(company.legalName)
  await page.getByLabel("SIREN", { exact: true }).fill(company.siren)
  await page.getByLabel("Site web (facultatif)").fill("www.hotel-e2e.example")
  await page.getByLabel("Votre fonction").fill("Directrice")
  await page.getByLabel("Lien avec l’entreprise").click()
  await page.getByRole("option", { name: relationship.option }).click()
  if (relationship.details) {
    await page.getByLabel("Précisez votre lien").fill(relationship.details)
  }
  await page.getByLabel("Téléphone professionnel").fill("04 65 71 12 34")
  await page
    .getByLabel(
      "Je certifie être habilité·e à publier des offres pour cette entreprise",
    )
    .check()
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click()

  await expect(page.getByText(PENDING_BANNER)).toBeVisible()
  await expect(page.getByText("En vérification", { exact: true })).toBeVisible()
}

// La demande dans la file de l'admin, ouverte dans son tiroir.
async function openRequest(admin: Page, legalName: string, name: string) {
  await admin.goto("/admin/verifications", { waitUntil: "networkidle" })
  const row = admin.getByRole("row").filter({ hasText: legalName })
  await row.getByRole("button", { name }).click()
  return admin.getByRole("dialog")
}

test("§6 — onboarding vérifié par l'admin avant toute publication", async ({
  newEmployer,
  asAdmin,
  asCandidate,
  db,
}) => {
  const { page, name, email } = await newEmployer("valide")
  const siren = randomSiren()
  const legalName = `Hôtel Valide ${siren}`

  await onboard(page, { legalName, siren }, { option: "RH / recrutement" })
  await expectEmail(
    process.env.ADMIN_NOTIFICATION_EMAIL!,
    `Rattachement à vérifier — ${legalName}`,
  )

  // Avant la vérification, son annonce attend, invisible des candidats.
  const offerId = await insertPendingOffer(db, email)
  await asCandidate.goto(`/offres/${offerId}`)
  await expect(asCandidate.getByText("Page introuvable")).toBeVisible()

  const drawer = await openRequest(asAdmin, legalName, name)
  await expect(drawer.getByText("RH / recrutement")).toBeVisible()
  // Aide à la décision : l'email n'est pas sur le domaine du site déclaré.
  await expect(drawer.getByText("Autre domaine")).toBeVisible()
  await expect(
    drawer.getByRole("link", {
      name: `${siren} sur l’Annuaire des entreprises`,
    }),
  ).toHaveAttribute(
    "href",
    `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`,
  )
  await drawer.getByRole("button", { name: "Valider le rattachement" }).click()
  await expect(
    asAdmin.getByText(`Rattachement de ${name} validé.`),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByText("Vérifié", { exact: true })).toBeVisible()
  await expect(page.getByText(PENDING_BANNER)).toHaveCount(0)
  const decision = await expectEmail(email, /^Votre rattachement est vérifié/)
  expect(decision.text).toContain(
    `Votre rattachement à ${legalName} est vérifié.`,
  )

  // Validée, l'annonce en attente est publiée.
  await asCandidate.goto(`/offres/${offerId}`)
  await expect(
    asCandidate.getByRole("heading", { name: "Réceptionniste de nuit" }),
  ).toBeVisible()
})

test("§6 — rattachement refusé avec motif", async ({
  newEmployer,
  asAdmin,
}) => {
  const { page, name, email } = await newEmployer("refuse")
  const siren = randomSiren()
  const legalName = `Hôtel Refusé ${siren}`
  const motive = "Aucun lien vérifiable avec cette entreprise."

  await onboard(
    page,
    { legalName, siren },
    { option: "Autre (à préciser)", details: "Ami du gérant" },
  )

  const drawer = await openRequest(asAdmin, legalName, name)
  await expect(drawer.getByText("Autre : Ami du gérant")).toBeVisible()
  await drawer.getByRole("button", { name: "Refuser le rattachement" }).click()
  // Sans motif, rien n'est envoyé.
  await expect(drawer.getByLabel("Motif du refus")).toBeFocused()
  await drawer.getByLabel("Motif du refus").fill(motive)
  await drawer.getByRole("button", { name: "Refuser le rattachement" }).click()
  await expect(
    asAdmin.getByText(`Rattachement de ${name} refusé.`),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByText("Rattachement refusé")).toBeVisible()
  await expect(page.getByText(`Motif : ${motive}`)).toBeVisible()
  await expect(page.getByText("Refusé", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Modifier vos informations" }),
  ).toHaveCount(0)
  const decision = await expectEmail(
    email,
    /^Votre rattachement n'a pas été validé/,
  )
  expect(decision.text).toContain(`Motif : ${motive}`)
})
