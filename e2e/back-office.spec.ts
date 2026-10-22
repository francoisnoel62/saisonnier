import { randomUUID } from "node:crypto"

import type { Page } from "@playwright/test"
import type { Pool } from "pg"

import { expect, test } from "./fixtures"
import { completeDossier } from "./helpers/dossier"
import {
  fillMinimalOffer,
  openNewOfferForm,
  stubCommuneSearch,
} from "./helpers/offer-form"
import { offerIdByTitle } from "./helpers/offers"

// Back-office du fondateur : annonces collectées, modération et référentiels (plan 15).

// Propre au test : les deux projets (chromium, mobile) partagent la base.
const unique = () => randomUUID().slice(0, 8)

const offerCard = (page: Page, title: string) =>
  page
    .locator("#resultats [data-slot=card]")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) })

// Annonce publiée à Gérardmer (88) pour une entreprise sans compte ; renvoie son identifiant.
async function insertPublishedOffer(
  db: Pool,
  {
    title,
    companyName,
    origin = "deposited",
    applyEmail = null,
    applyUrl = null,
  }: {
    title: string
    companyName: string
    origin?: "deposited" | "collected"
    applyEmail?: string | null
    applyUrl?: string | null
  },
) {
  const {
    rows: [company],
  } = await db.query<{ id: string }>(
    "insert into companies (legal_name) values ($1) returning id",
    [companyName],
  )
  const sourceUrl =
    origin === "collected"
      ? `https://www.hotel-e2e.example/emplois/${randomUUID()}`
      : null
  const {
    rows: [offer],
  } = await db.query<{ id: string }>(
    `insert into offers (origin, status, published_at, validity_confirmed_at, company_id, title,
       season, commune_name, commune_insee_code, postal_code, department_code, duration_value,
       duration_unit, apply_email, apply_url, source_url, source_checked_at)
     values ($1, 'published', now(), now(), $2, $3, 'winter', 'Gérardmer', '88196', '88400',
       '88', 4, 'months', $4, $5, $6, case when $6::text is null then null else now() end)
     returning id`,
    [origin, company.id, title, applyEmail, applyUrl, sourceUrl],
  )
  return offer.id
}

test("§6 — l'admin saisit une annonce collectée avec un lien officiel : elle est visible côté candidat, avec sa provenance", async ({
  asAdmin: page,
  asCandidate,
  db,
}) => {
  const id = unique()
  const title = `Serveur collecté ${id}`
  const companyName = `Hôtel Collecte ${id}`
  const sourceUrl = `https://www.hotel-collecte.example/emplois/${id}`

  await stubCommuneSearch(page)
  await page.goto("/admin/annonces/nouvelle", { waitUntil: "networkidle" })

  // Une entreprise sans compte : sa fiche est créée depuis le formulaire.
  await page.getByRole("button", { name: "Créer une fiche entreprise" }).click()
  const dialog = page.getByRole("dialog", { name: "Nouvelle fiche entreprise" })
  await dialog.getByLabel("Raison sociale").fill(companyName)
  await dialog.getByRole("button", { name: "Créer la fiche" }).click()
  await expect(page.getByText("Fiche entreprise créée.")).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("combobox", { name: /^Entreprise/ }),
  ).toContainText(companyName)

  await page
    .getByLabel("Lien de l'annonce sur le site officiel")
    .fill(sourceUrl)
  await page
    .getByLabel("Nom de la source")
    .fill("Site carrières de l'Hôtel Collecte")
  // Le lien officiel suffit pour une annonce collectée.
  await fillMinimalOffer(page, {
    title,
    applyUrl: "https://www.hotel-collecte.example/candidater",
  })
  await expect(page.getByText("Le minimum est atteint.")).toBeVisible()
  await page.getByRole("button", { name: "Publier l'annonce" }).click()

  await expect(page).toHaveURL("/admin/annonces")
  await expect(
    page.getByText("Annonce publiée : elle est visible des candidats."),
  ).toBeVisible()
  await page.getByLabel("Intitulé").fill(title)
  const row = page.getByRole("row").filter({ hasText: title })
  await expect(row.getByText("Collectée", { exact: true })).toBeVisible()
  await expect(row.getByText("En ligne")).toBeVisible()

  const offerId = await offerIdByTitle(db, title)
  const {
    rows: [stored],
  } = await db.query(
    `select origin, status, source_url, source_name, created_by_user_id,
       source_checked_at is not null as checked, apply_email, apply_url
     from offers where id = $1`,
    [offerId],
  )
  expect(stored).toEqual({
    origin: "collected",
    status: "published",
    source_url: sourceUrl,
    source_name: "Site carrières de l'Hôtel Collecte",
    created_by_user_id: null,
    checked: true,
    apply_email: null,
    apply_url: "https://www.hotel-collecte.example/candidater",
  })

  await asCandidate.goto(`/offres/${offerId}`)
  await expect(asCandidate.getByRole("heading", { name: title })).toBeVisible()
  await expect(
    asCandidate.getByText(
      new RegExp(
        `^Annonce publiée sur le site officiel de ${companyName} — source consultée le `,
      ),
    ),
  ).toBeVisible()

  await asCandidate.goto("/offres?dept=88")
  await expect(
    offerCard(asCandidate, title).getByText(
      "Collectée sur le site de l'employeur",
    ),
  ).toBeVisible()
})

test("§9 — après l'ajout d'un domaine exclu, l'annonce concernée est signalée et son lien n'est plus affiché", async ({
  asAdmin: page,
  newCandidate,
  db,
}) => {
  const id = unique()
  const domain = `jobs-${id}.example`
  const title = `Réceptionniste ${id}`
  const offerId = await insertPublishedOffer(db, {
    title,
    companyName: `Hôtel Lien ${id}`,
    origin: "collected",
    applyUrl: `https://www.${domain}/postuler/42`,
  })

  const { page: candidate } = await newCandidate("domaine-exclu")
  await completeDossier(candidate, `domaine-exclu-${id}`)
  await candidate.goto(`/offres/${offerId}`)
  await expect(
    candidate.getByRole("link", { name: `Site officiel : ${domain}` }),
  ).toBeVisible()

  try {
    await page.goto("/admin/referentiels?onglet=domaines-exclus", {
      waitUntil: "networkidle",
    })
    await page
      .getByLabel("Domaine à exclure")
      .fill(`https://www.${domain}/offres`)
    await page.getByLabel("Motif").fill("Job-board de test")
    await page.getByRole("button", { name: "Exclure ce domaine" }).click()

    await expect(page.getByText(`${domain} est exclu.`)).toBeVisible()
    const alert = page
      .getByRole("alert")
      .filter({ hasText: `1 annonce publiée mène à ${domain}` })
    await expect(alert).toBeVisible()
    await expect(
      alert.getByRole("link", { name: `Modifier « ${title} »` }),
    ).toHaveAttribute("href", `/admin/annonces/${offerId}/modifier`)

    // Signalée dans le back-office.
    await page.goto("/admin/annonces")
    await page.getByLabel("Intitulé").fill(title)
    const row = page.getByRole("row").filter({ hasText: title })
    await expect(row.getByText("Domaine exclu")).toBeVisible()
    await expect(
      row.getByText(`Les liens vers ${domain} ne sont pas acceptés`),
    ).toBeVisible()

    // Le lien n'est plus affiché aux candidats.
    await candidate.reload()
    await expect(candidate.getByText("Lien indisponible")).toBeVisible()
    await expect(
      candidate.getByRole("link", { name: /^Site officiel/ }),
    ).toHaveCount(0)
  } finally {
    // Les domaines exclus sont un référentiel : l'E2E ne les vide pas.
    await db.query("delete from blocked_domains where domain = $1", [domain])
  }
})

test("§7 — une annonce anonyme confiée à un chargé de recrutement ne nomme pas l'entreprise côté candidat", async ({
  asAdmin: page,
  asCandidate,
  db,
}) => {
  const id = unique()
  const title = `Commis de cuisine ${id}`
  const companyName = `Résidence Discrète ${id}`
  const offerId = await insertPublishedOffer(db, {
    title,
    companyName,
    applyEmail: "rh@residence-e2e.example",
  })

  await stubCommuneSearch(page)
  await page.goto(`/admin/annonces/${offerId}/modifier`, {
    waitUntil: "networkidle",
  })
  // Sans intermédiation, l'anonymat n'est pas possible (§7).
  const hide = page.getByLabel("Masquer l’identité de l’entreprise")
  await expect(hide).toBeDisabled()
  await page
    .getByRole("radiogroup", { name: "Qui reçoit les candidatures ?" })
    .getByRole("radio", { name: "Un chargé de recrutement du service" })
    .check()
  await page.getByLabel("Nom du chargé de recrutement").fill("Alix Martin")
  await page
    .getByLabel("Email de candidature")
    .fill("alix.martin@service-e2e.example")
  await hide.check()
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click()

  await expect(page).toHaveURL("/admin/annonces")
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible()
  const {
    rows: [stored],
  } = await db.query(
    `select application_channel, recruiter_name, hide_company_identity, status
     from offers where id = $1`,
    [offerId],
  )
  expect(stored).toEqual({
    application_channel: "recruiter",
    recruiter_name: "Alix Martin",
    hide_company_identity: true,
    status: "published",
  })

  // L'identité reste connue du service : le back-office la montre.
  await page.getByLabel("Intitulé").fill(title)
  await expect(
    page.getByRole("row").filter({ hasText: title }).getByText(companyName),
  ).toBeVisible()

  await asCandidate.goto(`/offres/${offerId}`)
  await expect(asCandidate.getByRole("heading", { name: title })).toBeVisible()
  await expect(
    asCandidate.getByText("Entreprise confidentielle", { exact: true }),
  ).toBeVisible()
  await expect(asCandidate.getByText(companyName)).toHaveCount(0)
  await expect(asCandidate).not.toHaveTitle(new RegExp(companyName))

  await asCandidate.goto("/offres?dept=88")
  const card = offerCard(asCandidate, title)
  await expect(card.getByText("Entreprise confidentielle")).toBeVisible()
  await expect(card).not.toContainText(companyName)
})

test("Référentiels — un métier ajouté est proposé au dépôt ; désactivé, il ne l'est plus", async ({
  asAdmin: page,
  asEmployer,
  db,
}) => {
  const label = `Métier E2E ${unique()}`
  const occupationOptions = async () => {
    await openNewOfferForm(asEmployer)
    await asEmployer.getByLabel("Métier (facultatif)").click()
    await expect(
      asEmployer.getByRole("option", { name: "Commis de cuisine" }),
    ).toBeVisible()
    return asEmployer.getByRole("option", { name: label })
  }

  try {
    await page.goto("/admin/referentiels", { waitUntil: "networkidle" })
    await page.getByLabel("Intitulé du métier").fill(label)
    await page.getByLabel("Famille").fill("Cuisine")
    await page.getByRole("button", { name: "Ajouter le métier" }).click()
    await expect(page.getByText(`Métier « ${label} » ajouté.`)).toBeVisible()
    const row = page.getByRole("row").filter({ hasText: label })
    await expect(row.getByText("Proposé")).toBeVisible()

    await expect(await occupationOptions()).toBeVisible()

    await row.getByRole("button", { name: `Désactiver : ${label}` }).click()
    await expect(row.getByText("Désactivé")).toBeVisible()

    await expect(await occupationOptions()).toHaveCount(0)
  } finally {
    // Les métiers sont un référentiel : l'E2E ne les vide pas.
    await db.query("delete from occupations where label = $1", [label])
  }
})
