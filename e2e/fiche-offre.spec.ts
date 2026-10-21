import type { Page } from "@playwright/test"

import { isActive, todayInParis } from "../src/domain/offer-activity"
import { demoCompanies } from "../src/lib/db/seed/demo-data"
import { expect, test } from "./fixtures"
import { seedDemoCatalog, type DemoCatalog } from "./helpers/catalog"
import { completeDossier } from "./helpers/dossier"

// Fiche d'une offre et parcours de candidature (plan 11), sur le jeu de démonstration.

let catalog: DemoCatalog

test.beforeAll(async ({ db }) => {
  catalog = await seedDemoCatalog(db)
})

function demoOffer(
  predicate: (offer: DemoCatalog["offers"][number]) => boolean,
) {
  const offer = catalog.offers.find(predicate)
  if (!offer) throw new Error("Offre de démonstration introuvable.")
  return offer
}

// Publiée, mais sa date limite est passée : plus active (§6).
const pastDeadline = (o: DemoCatalog["offers"][number]) =>
  o.status === "published" &&
  !!o.applicationDeadline &&
  !isActive(o, todayInParis(new Date()))

// Le HTML tel que le serveur l'envoie, données RSC comprises.
async function serverHtml(page: Page, path: string) {
  const response = await page.request.get(path)
  expect(response.status()).toBe(200)
  return response.text()
}

// Valeur d'une ligne de la fiche : « Logement fourni » → « Oui ».
const detail = (page: Page, label: string) =>
  page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd")

test("§9 — sans CV, le HTML de la fiche ne contient ni l'email ni le téléphone de l'offre", async ({
  newCandidate,
}) => {
  const offer = demoOffer((o) => o.title === "Réceptionniste de nuit")
  const { page } = await newCandidate("fiche-sans-cv")
  const path = `/offres/${offer.id}`

  await page.goto(path)
  await expect(page.getByRole("heading", { name: offer.title })).toBeVisible()
  // §7 : le mode de candidature est toujours expliqué.
  await expect(
    page.getByRole("heading", { name: "Comment postuler" }),
  ).toBeVisible()
  await expect(
    page.getByText(/Vous transmettez vous-même votre dossier/),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Compléter mon dossier" }),
  ).toHaveAttribute("href", `/dossier?${new URLSearchParams({ retour: path })}`)

  for (const html of [await page.content(), await serverHtml(page, path)]) {
    expect(html).not.toContain(offer.applyEmail!)
    expect(html).not.toContain(offer.applyPhone!)
    expect(html).not.toContain(offer.applyPhone!.replace(/\s/g, ""))
    expect(html).not.toContain("mailto:")
    expect(html).not.toContain("tel:")
  }
})

test("§9 — après l'envoi du CV, les liens mailto: et tel: apparaissent", async ({
  newCandidate,
}) => {
  const offer = demoOffer((o) => o.title === "Réceptionniste de nuit")
  const { page, name } = await newCandidate("fiche-complet")

  // Depuis la fiche, le dossier se complète puis ramène à l'offre.
  await page.goto(`/offres/${offer.id}`)
  await page.getByRole("link", { name: "Compléter mon dossier" }).click()
  await expect(page).toHaveURL(
    `/dossier?${new URLSearchParams({ retour: `/offres/${offer.id}` })}`,
  )
  await completeDossier(page, "fiche")
  await page.getByRole("link", { name: "Revenir à l’offre" }).click()
  await expect(page).toHaveURL(`/offres/${offer.id}`)

  const email = page.getByRole("link", { name: offer.applyEmail! })
  const mailto = new URL((await email.getAttribute("href"))!)
  expect(mailto.protocol).toBe("mailto:")
  expect(mailto.pathname).toBe(offer.applyEmail)
  expect(mailto.searchParams.get("subject")).toBe(
    `Candidature – ${offer.title} – ${name}`,
  )
  await expect(
    page.getByRole("link", { name: offer.applyPhone! }),
  ).toHaveAttribute("href", `tel:${offer.applyPhone!.replace(/\s/g, "")}`)
  await expect(
    page.getByRole("link", { name: "Télécharger mon CV" }),
  ).toHaveAttribute("href", "/api/dossier/documents/cv")
})

test("§9 — une offre au logement inconnu affiche « Non précisé »", async ({
  asCandidate: page,
}) => {
  const offer = catalog.matching({}).find((o) => !o.housing)!
  await page.goto(`/offres/${offer.id}`)
  await expect(detail(page, "Logement fourni")).toHaveText("Non précisé")
  await expect(detail(page, "Repas fournis")).toHaveText("Non précisé")
})

test("§9 — une offre au salaire brut horaire affiche « € brut / heure »", async ({
  asCandidate: page,
}) => {
  const offer = demoOffer((o) => o.title === "Commis de cuisine")
  expect(offer).toMatchObject({
    salaryGrossUnit: "hour",
    salaryGrossMinCents: 1250,
  })

  await page.goto(`/offres/${offer.id}`)
  await expect(detail(page, "Salaire")).toContainText("12,50")
  await expect(detail(page, "Salaire")).toContainText("€ brut / heure")
})

test("§6 — une offre collectée affiche sa provenance et le lien de contact", async ({
  asCandidate: page,
}) => {
  const offer = demoOffer(
    (o) =>
      o.origin === "collected" &&
      o.title.startsWith("Agent / agente de remontées"),
  )
  await page.goto(`/offres/${offer.id}`)

  await expect(
    page.getByText(
      /^Annonce publiée sur le site officiel de SPL Domaine skiable du Val Clair — source consultée le \d+ \S+ \d{4}$/,
    ),
  ).toBeVisible()
  await expect(page.getByText("Annonce déposée par l’employeur")).toHaveCount(0)
  await expect(
    page.getByRole("link", {
      name: "Vous êtes l’employeur ? Pour compléter, corriger ou retirer cette annonce, contactez-nous",
    }),
  ).toHaveAttribute(
    "href",
    `/contact?motif=annonce-collectee&offre=${offer.id}`,
  )
})

test("§6 — une offre dont la date limite est passée n'affiche plus aucune coordonnée", async ({
  newCandidate,
}) => {
  const offer = demoOffer((o) => pastDeadline(o) && o.origin === "deposited")
  const { page } = await newCandidate("fiche-echue")
  await completeDossier(page, "echue")

  const path = `/offres/${offer.id}`
  await page.goto(path)
  await expect(page.getByText("Cette offre n’est plus active")).toBeVisible()
  await expect(page.getByText(offer.title)).toBeVisible()
  await expect(page.getByText("Hôtel du Grand Sérac")).toBeVisible()
  await expect(
    page.getByText("La date limite de candidature est passée."),
  ).toBeVisible()
  for (const html of [await page.content(), await serverHtml(page, path)]) {
    expect(html).not.toContain(offer.applyEmail!)
    expect(html).not.toContain("mailto:")
    expect(html).not.toContain("tel:")
  }
})

test("§7 — le nom d'une entreprise anonyme n'apparaît nulle part dans le HTML", async ({
  newCandidate,
}) => {
  const offer = demoOffer((o) => o.hideCompanyIdentity === true)
  const company = demoCompanies.find((c) => c.id === offer.companyId)!
  const { page } = await newCandidate("fiche-anonyme")
  await completeDossier(page, "anonyme")

  const path = `/offres/${offer.id}`
  await page.goto(path)
  await expect(page).toHaveTitle(/Entreprise confidentielle/)
  await expect(
    page.getByText(
      /chargé·e de recrutement de .+ pour le compte de une entreprise qui souhaite rester confidentielle/,
    ),
  ).toBeVisible()

  const names = [company.legalName, company.displayName!]
  for (const html of [await page.content(), await serverHtml(page, path)]) {
    for (const name of names) expect(html).not.toContain(name)
  }
  // Sa carte, dans la recherche, ne la nomme pas non plus.
  await page.goto(`/offres?dept=${offer.departmentCode}`)
  const card = page.locator("#resultats li", {
    has: page.getByRole("link", { name: offer.title, exact: true }),
  })
  await expect(card).toContainText("Entreprise confidentielle")
  for (const name of names) await expect(card).not.toContainText(name)
})

test("§9 — un lien ou un email vers un job-board exclu n'est jamais affiché", async ({
  newCandidate,
  db,
}) => {
  const offer = demoOffer((o) => o.title === "Chef de partie")
  // Le domaine est devenu exclu après la publication.
  await db.query(
    "update offers set apply_url = $2, apply_email = $3 where id = $1",
    [
      offer.id,
      "https://fr.indeed.com/emploi/chef-de-partie",
      "chef@indeedemail.com",
    ],
  )
  const { page } = await newCandidate("fiche-exclu")
  await completeDossier(page, "exclu")

  const path = `/offres/${offer.id}`
  await page.goto(path)
  await expect(page.getByText("Lien indisponible")).toBeVisible()
  await expect(page.getByText("Adresse email indisponible")).toBeVisible()
  await expect(
    page.getByRole("link", { name: offer.applyPhone! }),
  ).toBeVisible()
  for (const html of [await page.content(), await serverHtml(page, path)]) {
    expect(html).not.toContain("indeed")
  }
})

test("§7 — l'admin voit toujours les coordonnées, même d'une offre échue", async ({
  asAdmin: page,
}) => {
  const expired = demoOffer((o) => pastDeadline(o) && !!o.applyEmail)
  await page.goto(`/offres/${expired.id}`)
  await expect(
    page.getByText("Cette offre n’est pas visible des candidats"),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: expired.applyEmail! }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Télécharger mon CV" }),
  ).toHaveCount(0)
})
