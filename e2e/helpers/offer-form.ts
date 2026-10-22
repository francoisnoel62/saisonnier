import { expect, type Page } from "@playwright/test"

// Formulaire de dépôt d'une annonce (plan 14).

type GeoCommune = {
  nom: string
  code: string
  codesPostaux: string[]
  codeDepartement: string
}

export const GERARDMER: GeoCommune = {
  nom: "Gérardmer",
  code: "88196",
  codesPostaux: ["88400"],
  codeDepartement: "88",
}

// La recherche des communes (geo.api.gouv.fr) est servie par le test : l'E2E ne dépend pas du
// réseau. Sans réponse (`unavailable`), le formulaire passe à la saisie manuelle.
export async function stubCommuneSearch(
  page: Page,
  response: GeoCommune[] | "unavailable" = [GERARDMER],
) {
  await page.route(
    (url) => url.hostname === "geo.api.gouv.fr",
    (route) =>
      response === "unavailable"
        ? route.abort("connectionfailed")
        : route.fulfill({
            json: response,
            headers: { "access-control-allow-origin": "*" },
          }),
  )
}

// Le formulaire n'envoie rien tant qu'il n'est pas hydraté.
export async function openNewOfferForm(page: Page) {
  await stubCommuneSearch(page)
  await page.goto("/employeur/annonces/nouvelle", { waitUntil: "networkidle" })
}

export async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

// Le minimum de publication (§3) : intitulé, contrat saisonnier, saison, durée, commune et contact.
export async function fillMinimalOffer(
  page: Page,
  offer: {
    title: string
    applyEmail?: string
    applyPhone?: string
    applyUrl?: string
  },
) {
  await page.getByLabel("Intitulé du poste").fill(offer.title)
  await page.getByLabel("Il s’agit d’un contrat saisonnier").check()
  await page
    .getByRole("radiogroup", { name: "Saison" })
    .getByRole("radio", { name: "Hiver" })
    .check()
  await page
    .getByRole("radiogroup", { name: "Période du contrat" })
    .getByRole("radio", { name: "Une durée" })
    .check()
  await page.getByLabel("Durée", { exact: true }).fill("4")
  await chooseOption(page, "Unité de durée", "Mois")

  await page
    .getByRole("combobox", { name: "Commune", exact: true })
    .fill("gerard")
  await page.getByRole("option", { name: /^Gérardmer/ }).click()
  await expect(page.getByText("Gérardmer (88400)")).toBeVisible()

  if (offer.applyEmail) {
    await page.getByLabel("Email de candidature").fill(offer.applyEmail)
  }
  if (offer.applyPhone) {
    await page.getByLabel("Téléphone de candidature").fill(offer.applyPhone)
  }
  if (offer.applyUrl) {
    await page
      .getByLabel("Lien officiel de candidature (facultatif)")
      .fill(offer.applyUrl)
  }
}

// Menu « Actions » d'une annonce de la liste de l'employeur. Le menu précédent doit avoir fini
// de se refermer : à la fin de son animation, il rend le focus à son bouton, ce qui refermerait
// un menu rouvert entre-temps.
export async function offerAction(page: Page, title: string, action: string) {
  await expect(page.getByRole("menu")).toHaveCount(0)
  await page.getByRole("button", { name: `Actions pour « ${title} »` }).click()
  await page.getByRole("menuitem", { name: action }).click()
}
