import { randomUUID } from "node:crypto"

import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { insertMembership } from "./helpers/company"
import {
  chooseOption,
  fillMinimalOffer,
  offerAction,
  openNewOfferForm,
  stubCommuneSearch,
} from "./helpers/offer-form"
import {
  insertCollectedOffer,
  insertDepositedOffer,
  offerIdByTitle,
} from "./helpers/offers"

// Dépôt et gestion des annonces par l'employeur (plan 14).

const PENDING_BANNER =
  "Votre rattachement est en cours de vérification. Vos annonces seront publiées après validation."
const INDEED_LINK =
  "Les liens vers indeed.fr ne sont pas acceptés : indiquez un contact direct de l'entreprise."
const INDEED_EMAIL =
  "Les adresses @indeedemail.com ne sont pas acceptées : indiquez un contact direct de l'entreprise."

// Un intitulé propre au test : les deux projets (chromium, mobile) partagent la base.
const uniqueTitle = (label: string) => `${label} ${randomUUID().slice(0, 8)}`

// Valeur d'une ligne de la fiche : « Logement fourni » → « Non précisé ».
const detail = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd")

const offerRow = (page: Page, title: string) =>
  page.getByRole("row").filter({ hasText: title })

// L'annonce dans les résultats de la recherche, Vosges (88) sélectionnées.
async function searchResult(page: Page, title: string) {
  await page.goto("/offres?dept=88")
  return page
    .locator("#resultats")
    .getByRole("link", { name: title, exact: true })
}

test("§3 — un employeur vérifié publie une annonce minimale, visible côté candidat avec « Non précisé » sur tout le reste", async ({
  newEmployer,
  asCandidate,
  db,
}) => {
  const { page, email } = await newEmployer("depot-minimal")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Serveur minimal")

  await openNewOfferForm(page)
  await expect(page.getByText("Il manque 4 éléments.")).toBeVisible()
  await fillMinimalOffer(page, { title, applyEmail: "rh@hotel-e2e.example" })
  await expect(page.getByText("Le minimum est atteint.")).toBeVisible()
  await page.getByRole("button", { name: "Publier l'annonce" }).click()

  await expect(page).toHaveURL("/employeur/annonces")
  await expect(
    page.getByText("Annonce publiée : elle est visible des candidats."),
  ).toBeVisible()
  await expect(offerRow(page, title).getByText("En ligne")).toBeVisible()

  // Rien n'a été inventé : chaque réponse non donnée vaut « Non précisé », jamais « Non ».
  const id = await offerIdByTitle(db, title)
  const {
    rows: [stored],
  } = await db.query(
    `select origin, status, application_channel, hide_company_identity, housing, meals,
       experience_required, languages_required, languages, driving_license_required,
       couples_welcome, pets_allowed, work_time, description, salary_net_min_cents,
       salary_gross_min_cents, apply_phone, apply_url
     from offers where id = $1`,
    [id],
  )
  expect(stored).toEqual({
    origin: "deposited",
    status: "published",
    application_channel: "employer",
    hide_company_identity: false,
    housing: "unknown",
    meals: "unknown",
    experience_required: "unknown",
    languages_required: "unknown",
    languages: [],
    driving_license_required: "unknown",
    couples_welcome: "unknown",
    pets_allowed: "unknown",
    work_time: "unknown",
    description: null,
    salary_net_min_cents: null,
    salary_gross_min_cents: null,
    apply_phone: null,
    apply_url: null,
  })

  await asCandidate.goto(`/offres/${id}`)
  await expect(asCandidate.getByRole("heading", { name: title })).toBeVisible()
  await expect(detail(asCandidate, "Période")).toHaveText("4 mois")
  await expect(detail(asCandidate, "Commune")).toHaveText("Gérardmer (88400)")
  for (const label of [
    "Métier",
    "Description",
    "Missions",
    "Logement fourni",
    "Repas fournis",
    "Expérience exigée",
    "Langues exigées",
    "Permis de conduire exigé",
    "Temps de travail",
    "Heures par semaine",
    "Horaires",
    "Couples acceptés",
    "Animaux acceptés",
    "Autres contraintes",
  ]) {
    await expect(detail(asCandidate, label)).toHaveText("Non précisé")
  }
  await expect(detail(asCandidate, "Salaire")).toHaveText("Salaire non précisé")
  await expect(await searchResult(asCandidate, title)).toBeVisible()
})

test("H2 — l'annonce d'un employeur non vérifié est « en attente » et invisible", async ({
  newEmployer,
  asCandidate,
  db,
}) => {
  const { page, email } = await newEmployer("depot-attente")
  await insertMembership(db, email, "pending")
  const title = uniqueTitle("Réceptionniste en attente")

  await openNewOfferForm(page)
  await expect(page.getByText(PENDING_BANNER)).toBeVisible()
  await fillMinimalOffer(page, { title, applyPhone: "04 65 71 12 34" })
  await page.getByRole("button", { name: "Enregistrer l'annonce" }).click()

  await expect(page).toHaveURL("/employeur/annonces")
  await expect(
    page.getByText(
      "Annonce enregistrée : elle sera publiée après la vérification de votre rattachement.",
    ),
  ).toBeVisible()
  await expect(
    offerRow(page, title).getByText("En attente de vérification"),
  ).toBeVisible()

  const id = await offerIdByTitle(db, title)
  await asCandidate.goto(`/offres/${id}`)
  await expect(asCandidate.getByText("Page introuvable")).toBeVisible()
  await expect(await searchResult(asCandidate, title)).toHaveCount(0)

  await page.goto("/employeur")
  await expect(
    page.locator("[data-slot=card]", { hasText: "En attente de vérification" }),
  ).toContainText("1")
})

test("§9 — un lien indeed.fr est refusé", async ({ newEmployer, db }) => {
  const { page, email } = await newEmployer("depot-indeed")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Serveur lien exclu")

  await openNewOfferForm(page)
  await fillMinimalOffer(page, {
    title,
    applyEmail: "rh@hotel-e2e.example",
    applyUrl: "https://www.indeed.fr/emplois/123",
  })
  // L'encart du minimum le signale dès la saisie.
  await expect(page.getByText(INDEED_LINK)).toBeVisible()
  await page.getByRole("button", { name: "Publier l'annonce" }).click()

  await expect(page.locator("#offre-applyUrl-error")).toHaveText(INDEED_LINK)
  await expect(page).toHaveURL("/employeur/annonces/nouvelle")
  const { rowCount } = await db.query("select 1 from offers where title = $1", [
    title,
  ])
  expect(rowCount).toBe(0)
})

test("§9 — un email @indeedemail.com est refusé", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("depot-indeedemail")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Serveur email exclu")

  await openNewOfferForm(page)
  await fillMinimalOffer(page, {
    title,
    applyEmail: "candidature-42@indeedemail.com",
  })
  await page.getByRole("button", { name: "Publier l'annonce" }).click()

  await expect(page.locator("#offre-applyEmail-error")).toHaveText(INDEED_EMAIL)
  await expect(page.getByLabel("Email de candidature")).toBeFocused()
  const { rowCount } = await db.query("select 1 from offers where title = $1", [
    title,
  ])
  expect(rowCount).toBe(0)
})

test("§9 — le serveur refuse un domaine exclu après l'ouverture du formulaire", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("depot-serveur")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Serveur domaine exclu")
  const domain = `jobboard-${randomUUID().slice(0, 8)}.example`

  await openNewOfferForm(page)
  await fillMinimalOffer(page, {
    title,
    applyEmail: "rh@hotel-e2e.example",
    applyUrl: `https://www.${domain}/offres/1`,
  })
  // Le formulaire ne connaît pas encore ce domaine : seule la Server Action peut le refuser.
  await db.query(
    "insert into blocked_domains (domain, reason) values ($1, 'E2E')",
    [domain],
  )
  try {
    await page.getByRole("button", { name: "Publier l'annonce" }).click()
    await expect(page.locator("#offre-applyUrl-error")).toHaveText(
      `Les liens vers ${domain} ne sont pas acceptés : indiquez un contact direct de l'entreprise.`,
    )
    await expect(page.getByText("Corrigez les champs signalés.")).toBeVisible()
    const { rowCount } = await db.query(
      "select 1 from offers where title = $1",
      [title],
    )
    expect(rowCount).toBe(0)
  } finally {
    // Les référentiels ne sont pas vidés entre deux exécutions.
    await db.query("delete from blocked_domains where domain = $1", [domain])
  }
})

test("§6 — une annonce modifiée puis mise hors ligne disparaît de la recherche", async ({
  newEmployer,
  asCandidate,
  db,
}) => {
  const { page, email } = await newEmployer("depot-modifiee")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Barman")
  const renamed = `${title} (modifiée)`
  const id = await insertDepositedOffer(db, email, { title })
  await expect(await searchResult(asCandidate, title)).toBeVisible()

  await stubCommuneSearch(page)
  await page.goto("/employeur/annonces", { waitUntil: "networkidle" })
  await offerAction(page, title, "Modifier")
  await expect(page).toHaveURL(`/employeur/annonces/${id}/modifier`)
  await page.waitForLoadState("networkidle")
  await expect(page.getByLabel("Intitulé du poste")).toHaveValue(title)
  await page.getByLabel("Intitulé du poste").fill(renamed)
  await page
    .getByRole("radiogroup", { name: "Logement fourni" })
    .getByRole("radio", { name: "Oui" })
    .check()
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click()

  await expect(page).toHaveURL("/employeur/annonces")
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible()
  await expect(offerRow(page, renamed).getByText("En ligne")).toBeVisible()
  await expect(await searchResult(asCandidate, renamed)).toBeVisible()
  await asCandidate.goto(`/offres/${id}`)
  await expect(detail(asCandidate, "Logement fourni")).toHaveText("Oui")

  await offerAction(page, renamed, "Mettre hors ligne")
  await expect(
    page.getByText(
      `« ${renamed} » est hors ligne : les candidats ne la voient plus.`,
    ),
  ).toBeVisible()
  await expect(offerRow(page, renamed).getByText("Hors ligne")).toBeVisible()

  await expect(await searchResult(asCandidate, renamed)).toHaveCount(0)
  await asCandidate.goto(`/offres/${id}`)
  await expect(
    asCandidate.getByText("Cette offre n’est plus active"),
  ).toBeVisible()
  await expect(
    asCandidate.getByText("Elle a été retirée par l'employeur."),
  ).toBeVisible()
})

test("§6 — une annonce échue ne se remet en ligne qu'une fois ses dates corrigées", async ({
  newEmployer,
  asCandidate,
  db,
}) => {
  const { page, email } = await newEmployer("depot-echue")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Plongeur")
  const id = await insertDepositedOffer(db, email, {
    title,
    status: "unpublished",
    applicationDeadline: "2026-01-01",
  })

  await stubCommuneSearch(page)
  await page.goto("/employeur/annonces", { waitUntil: "networkidle" })
  const row = offerRow(page, title)
  await expect(
    row.getByText(
      "Échéance passée : modifiez ses dates pour la remettre en ligne.",
    ),
  ).toBeVisible()
  await offerAction(page, title, "Remettre en ligne")
  await expect(
    page.getByText(
      "La date limite de candidature est passée : modifiez-la avant de remettre l'annonce en ligne.",
    ),
  ).toBeVisible()
  await expect(row.getByText("Hors ligne")).toBeVisible()

  // Une date déjà passée ne s'enregistre pas : l'employeur la retire.
  await offerAction(page, title, "Modifier")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click()
  await expect(page.locator("#offre-applicationDeadline-error")).toHaveText(
    "La date limite de candidature est déjà passée.",
  )
  await page
    .getByRole("button", { name: "Effacer : Date limite de candidature" })
    .click()
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click()
  await expect(page).toHaveURL("/employeur/annonces")

  await offerAction(page, title, "Remettre en ligne")
  await expect(
    page.getByText(`« ${title} » est de nouveau en ligne.`),
  ).toBeVisible()
  await expect(offerRow(page, title).getByText("En ligne")).toBeVisible()
  await asCandidate.goto(`/offres/${id}`)
  await expect(asCandidate.getByRole("heading", { name: title })).toBeVisible()
})

test("§6 — une annonce collectée n'apparaît jamais dans l'espace employeur", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("depot-collectee")
  const companyId = await insertMembership(db, email, "verified")
  const title = uniqueTitle("Saisonnier collecté")
  const id = await insertCollectedOffer(db, title)
  // Collectée sur le site de l'entreprise même de l'employeur.
  await db.query("update offers set company_id = $2 where id = $1", [
    id,
    companyId,
  ])

  await page.goto("/employeur/annonces")
  await expect(page.getByText("Aucune annonce pour l’instant")).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)
  await page.goto(`/employeur/annonces/${id}/modifier`)
  await expect(page.getByText("Page introuvable")).toBeVisible()
})

test("§3 — si la recherche des communes ne répond pas, la commune se saisit à la main", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("depot-manuel")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Animateur")

  await stubCommuneSearch(page, "unavailable")
  await page.goto("/employeur/annonces/nouvelle", { waitUntil: "networkidle" })
  await page.getByLabel("Intitulé du poste").fill(title)
  await page.getByLabel("Il s’agit d’un contrat saisonnier").check()
  await page
    .getByRole("radiogroup", { name: "Saison" })
    .getByRole("radio", { name: "Été" })
    .check()
  await page
    .getByRole("radiogroup", { name: "Période du contrat" })
    .getByRole("radio", { name: "Une durée" })
    .check()
  await page.getByLabel("Durée", { exact: true }).fill("10")
  await chooseOption(page, "Unité de durée", "Semaines")

  await page
    .getByRole("combobox", { name: "Commune", exact: true })
    .fill("Gérardmer")
  await expect(
    page.getByText(
      "La recherche des communes ne répond pas : saisissez la commune et choisissez son département.",
    ),
  ).toBeVisible()
  await expect(page.getByLabel("Commune", { exact: true })).toHaveValue(
    "Gérardmer",
  )
  await chooseOption(page, "Département", "Vosges (88)")
  await page.getByLabel("Téléphone de candidature").fill("04 65 71 12 34")
  await page.getByRole("button", { name: "Publier l'annonce" }).click()

  await expect(page).toHaveURL("/employeur/annonces")
  await expect(offerRow(page, title).getByText("Gérardmer (88)")).toBeVisible()
  const {
    rows: [stored],
  } = await db.query(
    `select commune_name, commune_insee_code, postal_code, department_code,
       duration_value, duration_unit, season
     from offers where title = $1`,
    [title],
  )
  expect(stored).toEqual({
    commune_name: "Gérardmer",
    commune_insee_code: null,
    postal_code: null,
    department_code: "88",
    duration_value: 10,
    duration_unit: "weeks",
    season: "summer",
  })
})
