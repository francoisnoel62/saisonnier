import { randomUUID } from "node:crypto"

import type { Pool } from "pg"

import { expect, test } from "./fixtures"
import { insertMembership } from "./helpers/company"
import { fillMinimalOffer, openNewOfferForm } from "./helpers/offer-form"
import { insertDepositedOffer } from "./helpers/offers"
import { expectEmail } from "./helpers/outbox"

// Prestations employeurs, demandées par formulaire et traitées à la main (plan 17).

// Propre au test : les deux projets (chromium, mobile) partagent la base.
const unique = () => randomUUID().slice(0, 8)

// Employeur vérifié dont l'entreprise a une enseigne propre au test ; renvoie l'enseigne.
async function verifiedEmployer(db: Pool, email: string, brand: string) {
  const companyId = await insertMembership(db, email, "verified")
  await db.query("update companies set display_name = $2 where id = $1", [
    companyId,
    brand,
  ])
  return companyId
}

test("§7 — un employeur demande une prestation ; l'admin la passe « en cours » et l'employeur voit le nouveau statut", async ({
  newEmployer,
  asAdmin,
  db,
}) => {
  const id = unique()
  const brand = `Hôtel Prestation ${id}`
  const title = `Serveur accompagné ${id}`
  const { page, email } = await newEmployer("prestation")
  const companyId = await verifiedEmployer(db, email, brand)
  const offerId = await insertDepositedOffer(db, email, { title })

  await page.goto("/employeur/prestations", { waitUntil: "networkidle" })
  // Les engagements du §7 sont visibles.
  for (const commitment of [
    "Des prestations définies, sans garantie d'embauche.",
    "Aucun achat n'est nécessaire pour publier une annonce conforme.",
    "Des tarifs sur devis, après échange avec vous.",
    "Les CV privés des inscrits ne servent jamais de base de sourcing.",
  ]) {
    await expect(page.getByText(commitment)).toBeVisible()
  }

  await page.getByLabel("Tri selon les critères du poste").check()
  await page.getByLabel("Sélection humaine").check()
  await page.getByLabel("Annonce concernée").click()
  await page.getByRole("option", { name: new RegExp(`^${title}`) }).click()
  await page
    .getByRole("radiogroup", { name: "Formule" })
    .getByRole("radio", { name: "En package" })
    .check()
  await page
    .getByLabel("Message (facultatif)")
    .fill("Nous recrutons douze saisonniers pour l'été.")
  await page.getByRole("button", { name: "Envoyer la demande" }).click()
  await expect(
    page.getByRole("status").getByText("Demande envoyée"),
  ).toBeVisible()

  const notification = await expectEmail(
    process.env.ADMIN_NOTIFICATION_EMAIL!,
    `Demande de prestation — ${brand}`,
  )
  expect(notification.text).toContain(
    "Prestations : Tri selon les critères du poste, Sélection humaine",
  )
  expect(notification.text).toContain(`« ${title} »`)

  const {
    rows: [stored],
  } = await db.query(
    `select services::text[], scope, offer_id, purchase_format, status
     from service_requests where company_id = $1`,
    [companyId],
  )
  expect(stored).toEqual({
    services: ["screening", "human_selection"],
    scope: "offer",
    offer_id: offerId,
    purchase_format: "package",
    status: "new",
  })

  await page.reload()
  const mine = page
    .getByRole("region", { name: "Mes demandes" })
    .getByRole("listitem")
    .filter({ hasText: title })
  await expect(mine.getByText("Nouvelle")).toBeVisible()

  // L'admin la traite.
  await asAdmin.goto("/admin/demandes?onglet=prestations", {
    waitUntil: "networkidle",
  })
  await asAdmin.getByRole("button", { name: brand }).click()
  const drawer = asAdmin.getByRole("dialog", {
    name: `Demande de ${brand}`,
  })
  await expect(drawer.getByText("Prestation avec intermédiation")).toBeVisible()
  await expect(
    drawer.getByRole("link", { name: "Modifier l’annonce" }),
  ).toHaveAttribute("href", `/admin/annonces/${offerId}/modifier`)
  await drawer.getByLabel("Statut").click()
  await asAdmin.getByRole("option", { name: "En cours" }).click()
  await drawer
    .getByLabel("Note interne (facultatif)")
    .fill("Devis envoyé le jour même.")
  await drawer.getByRole("button", { name: "Enregistrer" }).click()
  await expect(asAdmin.getByText("Demande mise à jour.")).toBeVisible()

  const {
    rows: [handled],
  } = await db.query(
    "select status, admin_note from service_requests where company_id = $1",
    [companyId],
  )
  expect(handled).toEqual({
    status: "in_progress",
    admin_note: "Devis envoyé le jour même.",
  })

  // L'employeur voit le nouveau statut, jamais la note interne.
  await page.reload()
  await expect(mine.getByText("En cours")).toBeVisible()
  await expect(page.getByText("Devis envoyé le jour même.")).toHaveCount(0)
})

test("§7 — une demande incomplète est refusée sans perdre la saisie", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("prestation-incomplete")
  await verifiedEmployer(db, email, `Camping Prestation ${unique()}`)

  await page.goto("/employeur/prestations", { waitUntil: "networkidle" })
  await page.getByLabel("Recherche proactive et sourcing").check()
  // Sans annonce, la portée « campagne » est proposée d'emblée ; elle se précise.
  await expect(
    page
      .getByRole("radiogroup", { name: "Portée de la demande" })
      .getByRole("radio", { name: "Une campagne de recrutement" }),
  ).toBeChecked()
  await page.getByRole("button", { name: "Envoyer la demande" }).click()

  await expect(
    page.getByText(
      "Précisez la campagne : postes, nombre de recrutements, période.",
    ),
  ).toBeVisible()
  await expect(
    page.getByText("Choisissez une formule : à l'unité ou en package."),
  ).toBeVisible()
  await expect(page.getByLabel("Recherche proactive et sourcing")).toBeChecked()
})

test("§7 — le dépôt d'une annonce reste possible sans aucune demande de prestation", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("sans-prestation")
  const companyId = await verifiedEmployer(
    db,
    email,
    `Gîte Sans Prestation ${unique()}`,
  )
  const title = `Réceptionniste sans prestation ${unique()}`

  await openNewOfferForm(page)
  await fillMinimalOffer(page, { title, applyEmail: "rh@gite-e2e.example" })
  await page.getByRole("button", { name: "Publier l'annonce" }).click()
  await expect(
    page.getByText("Annonce publiée : elle est visible des candidats."),
  ).toBeVisible()

  const { rows } = await db.query(
    "select count(*)::int as requests from service_requests where company_id = $1",
    [companyId],
  )
  expect(rows[0].requests).toBe(0)
})
