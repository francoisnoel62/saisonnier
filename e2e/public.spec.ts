import type { Page } from "@playwright/test"

import { homePaths } from "./accounts"
import { expect, test } from "./fixtures"
import { insertCollectedOffer } from "./helpers/offers"
import { expectNoHorizontalScroll, openMenu } from "./helpers/shell"

// Les deux projets (chromium, mobile) partagent la base : chaque test a ses propres adresses.
function visitor(label: string, projectName: string) {
  return {
    name: `Visiteur ${label}`,
    email: `${label}-${projectName}@visiteur.test`,
    message: `Bonjour, ceci est un message ${label} (${projectName}).`,
  }
}

async function chooseTopic(page: Page, label: string) {
  await page.getByLabel("Sujet").click()
  await page.getByRole("option", { name: label }).click()
}

// Le formulaire n'envoie rien tant qu'il n'est pas hydraté : on attend la fin du chargement.
async function openContact(page: Page, query = "") {
  await page.goto(`/contact${query}`, { waitUntil: "networkidle" })
}

async function fillAndSend(
  page: Page,
  { name, email, message }: { name: string; email: string; message: string },
) {
  await page.getByLabel("Nom et prénom").fill(name)
  await page.getByLabel("Adresse email").fill(email)
  await page.getByLabel("Message", { exact: true }).fill(message)
  await page.getByRole("button", { name: "Envoyer le message" }).click()
}

test("§1/§5 — l'accueil ne montre aucune offre ni aucun lien vers une fiche", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { level: 1, name: /Votre prochaine saison./ }),
  ).toBeVisible()

  // Les offres sont réservées aux comptes : aucun lien vers le catalogue ni vers une fiche.
  await expect(page.locator('a[href^="/offres"]')).toHaveCount(0)
  if (await page.getByRole("button", { name: "Ouvrir le menu" }).isVisible()) {
    await page.getByRole("button", { name: "Ouvrir le menu" }).click()
    await expect(
      page
        .getByRole("navigation", { name: "Navigation mobile" })
        .getByRole("link", { name: "Se connecter" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Fermer le menu" }).click()
  } else {
    await expect(
      page.getByRole("link", { name: "Se connecter" }).first(),
    ).toBeVisible()
  }
  await expect(
    page.getByRole("link", { name: "Créer mon espace" }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Publier une offre", exact: true }).first(),
  ).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("§1 — un visiteur ne voit jamais une offre : /offres renvoie vers la connexion", async ({
  page,
}) => {
  await page.goto("/offres")
  await expect(page).toHaveURL(/\/connexion\?next=%2Foffres$/)
})

test("accueil — un utilisateur connecté accède à son espace", async ({
  asCandidate,
  asEmployer,
}) => {
  await asCandidate.goto("/")
  await asCandidate
    .getByRole("link", { name: "Mon espace", exact: true })
    .first()
    .click()
  await expect(asCandidate).toHaveURL(homePaths.candidate)

  await asEmployer.goto("/")
  await expect(
    asEmployer.getByRole("link", { name: "Se connecter" }),
  ).toHaveCount(0)
  await asEmployer
    .getByRole("link", { name: "Mon espace", exact: true })
    .first()
    .click()
  await expect(asEmployer).toHaveURL(homePaths.employer)
})

test("§7 — les pages légales sont publiques et signalées comme brouillons", async ({
  page,
}) => {
  const pages = [
    ["/mentions-legales", "Mentions légales"],
    ["/cgu", "Conditions générales d'utilisation"],
    ["/confidentialite", "Politique de confidentialité"],
  ] as const

  for (const [path, title] of pages) {
    await page.goto(path)
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible()
    await expect(page.getByText("Brouillon à valider")).toBeVisible()
    await expectNoHorizontalScroll(page)
  }

  // Le pied de page y mène depuis l'accueil.
  await page.goto("/")
  for (const name of [
    "Mentions légales",
    "CGU",
    "Confidentialité",
    "Contact",
  ]) {
    await expect(
      page
        .getByRole("navigation", { name: "Informations légales et contact" })
        .getByRole("link", { name }),
    ).toBeVisible()
  }
})

test("référencement — robots.txt autorise le public et interdit l'application", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text()
  expect(robots).toContain("Allow: /")
  for (const path of ["/offres", "/employeur", "/admin", "/api/"]) {
    expect(robots).toContain(`Disallow: ${path}`)
  }
  expect(robots).toContain("/sitemap.xml")

  const sitemap = await (await request.get("/sitemap.xml")).text()
  for (const path of [
    "/contact",
    "/cgu",
    "/mentions-legales",
    "/confidentialite",
  ]) {
    expect(sitemap).toContain(`${path}</loc>`)
  }
  expect(sitemap).not.toContain("/offres")
})

test("§6 — un message d'un visiteur anonyme est visible et traitable par l'admin", async ({
  page,
  asAdmin,
}, testInfo) => {
  const sender = visitor("anonyme", testInfo.project.name)

  await openContact(page)
  await chooseTopic(page, "Je suis employeur")
  await fillAndSend(page, sender)
  await expect(
    page.getByRole("heading", { name: "Message envoyé" }),
  ).toBeVisible()

  // Côté admin : le message est dans la boîte, à l'état « Nouveau ».
  await asAdmin.goto("/admin/demandes")
  const row = asAdmin.getByRole("row", { name: new RegExp(sender.email) })
  await expect(row).toBeVisible()
  await expect(row.getByText("Nouveau")).toBeVisible()
  await expect(row.getByText("Je suis employeur")).toBeVisible()

  // Détail, note, puis traitement.
  await row.getByRole("button", { name: sender.name }).click()
  const drawer = asAdmin.getByRole("dialog")
  await expect(drawer.getByText(sender.message)).toBeVisible()
  await drawer.getByLabel("Note (facultatif)").fill("Rappelé par téléphone.")
  await drawer.getByRole("button", { name: "Marquer comme traité" }).click()
  await expect(drawer.getByText(/Traité le/)).toBeVisible()
  await expect(drawer.getByText("Rappelé par téléphone.")).toBeVisible()
  await asAdmin.keyboard.press("Escape")

  await expect(row.getByText("Traité")).toBeVisible()
})

test("§6 — le tableau de l'admin se filtre par statut", async ({
  page,
  asAdmin,
}, testInfo) => {
  const sender = visitor("filtre", testInfo.project.name)
  await openContact(page)
  await fillAndSend(page, sender)
  await expect(
    page.getByRole("heading", { name: "Message envoyé" }),
  ).toBeVisible()

  await asAdmin.goto("/admin/demandes", { waitUntil: "networkidle" })
  const row = asAdmin.getByRole("row", { name: new RegExp(sender.email) })
  await expect(row).toBeVisible()

  await asAdmin.getByLabel("Statut").click()
  await asAdmin.getByRole("option", { name: "Traité" }).click()
  await expect(row).toHaveCount(0)

  await asAdmin.getByLabel("Statut").click()
  await asAdmin.getByRole("option", { name: "Nouveau" }).click()
  await expect(row).toBeVisible()
})

test("§6 — les pages d'administration restent réservées à l'admin", async ({
  asCandidate,
}) => {
  await asCandidate.goto("/admin/demandes")
  await expect(asCandidate).toHaveURL(homePaths.candidate)
})

test("contact — limité à 3 messages par adresse et par heure", async ({
  page,
  db,
}, testInfo) => {
  const sender = visitor("limite", testInfo.project.name)
  await db.query(
    `insert into contact_messages (topic, name, email, message)
     select 'other', $1, $2, 'Message précédent' from generate_series(1, 3)`,
    [sender.name, sender.email],
  )

  await openContact(page)
  await fillAndSend(page, sender)
  await expect(
    page.getByRole("alert").filter({ hasText: "plusieurs messages" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Message envoyé" }),
  ).toHaveCount(0)

  const { rows } = await db.query(
    "select count(*)::int as total from contact_messages where email = $1",
    [sender.email],
  )
  expect(rows[0].total).toBe(3)
})

test("contact — le champ piège anti-robot n'enregistre rien", async ({
  page,
  db,
}, testInfo) => {
  const sender = visitor("robot", testInfo.project.name)
  await openContact(page)
  await page.getByLabel("Ne pas remplir").fill("https://spam.example")
  await fillAndSend(page, sender)
  // Le robot croit à un succès…
  await expect(
    page.getByRole("heading", { name: "Message envoyé" }),
  ).toBeVisible()

  // …mais rien n'est enregistré.
  const { rows } = await db.query(
    "select count(*)::int as total from contact_messages where email = $1",
    [sender.email],
  )
  expect(rows[0].total).toBe(0)
})

test("contact — les erreurs de saisie sont expliquées et la saisie conservée", async ({
  page,
}) => {
  await openContact(page)
  await page.getByLabel("Nom et prénom").fill("Visiteur pressé")
  await page.getByLabel("Adresse email").fill("pas-un-email@x")
  await page.getByLabel("Message", { exact: true }).fill("Bonjour")
  // La validation du navigateur accepte cette adresse : c'est le serveur qui tranche.
  await page.getByRole("button", { name: "Envoyer le message" }).click()
  await expect(
    page.getByText("Saisissez une adresse email valide."),
  ).toBeVisible()
  await expect(page.getByLabel("Nom et prénom")).toHaveValue("Visiteur pressé")
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Bonjour",
  )
})

test("§9 — un message lié à une annonce collectée présélectionne le sujet", async ({
  asCandidate,
  db,
}, testInfo) => {
  const offerId = await insertCollectedOffer(db)
  await openContact(asCandidate, `?motif=annonce-collectee&offre=${offerId}`)

  // Connecté : nom et email sont préremplis.
  await expect(asCandidate.getByLabel("Adresse email")).toHaveValue(
    "candidat@e2e.test",
  )
  await expect(asCandidate.getByLabel("Sujet")).toContainText(
    "annonce collectée",
  )

  await asCandidate
    .getByLabel("Message", { exact: true })
    .fill(`Merci de corriger cette annonce (${testInfo.project.name}).`)
  await asCandidate.getByRole("button", { name: "Envoyer le message" }).click()
  await expect(
    asCandidate.getByRole("heading", { name: "Message envoyé" }),
  ).toBeVisible()

  const { rows } = await db.query(
    `select topic, offer_id, user_id is not null as has_user
       from contact_messages where message like $1`,
    [`%corriger cette annonce (${testInfo.project.name})%`],
  )
  expect(rows).toEqual([
    { topic: "collected_offer", offer_id: offerId, has_user: true },
  ])
})

test("contact — une annonce inconnue n'empêche pas l'envoi du message", async ({
  page,
  db,
}, testInfo) => {
  const sender = visitor("annonce-inconnue", testInfo.project.name)
  await openContact(
    page,
    `?motif=annonce-collectee&offre=${crypto.randomUUID()}`,
  )
  await fillAndSend(page, sender)
  await expect(
    page.getByRole("heading", { name: "Message envoyé" }),
  ).toBeVisible()

  // Le message est enregistré, sans rattachement à une annonce qui n'existe pas.
  const { rows } = await db.query(
    "select topic, offer_id from contact_messages where email = $1",
    [sender.email],
  )
  expect(rows).toEqual([{ topic: "collected_offer", offer_id: null }])
})

test("contact — l'entrée « Contact » du menu mène au formulaire", async ({
  asEmployer,
}) => {
  await asEmployer.goto("/employeur")
  await openMenu(asEmployer)
  await asEmployer.getByRole("link", { name: "Contact", exact: true }).click()
  await expect(asEmployer).toHaveURL("/contact")
  await expect(
    asEmployer.getByRole("heading", {
      level: 1,
      name: "Contacter le fondateur",
    }),
  ).toBeVisible()
  await expectNoHorizontalScroll(asEmployer)
})

test("accueil — la recherche conserve les critères jusqu’à la connexion", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("combobox", { name: "Métier", exact: true })
    .selectOption("serveur")
  await page
    .getByRole("combobox", { name: "Région", exact: true })
    .selectOption("84")
  await page.getByRole("checkbox", { name: "Avec logement" }).check()
  await page.getByRole("button", { name: "Trouver ma saison" }).click()
  await expect(page).toHaveURL(/\/connexion\?next=/)
  const next = new URL(
    new URL(page.url()).searchParams.get("next")!,
    "http://localhost",
  )
  expect(next.pathname).toBe("/offres")
  expect(next.searchParams.get("metier")).toBe("serveur")
  expect(next.searchParams.get("region")).toBe("84")
  expect(next.searchParams.get("logement")).toBe("oui")
})

test("accueil — une destination conserve son filtre géographique", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("link", { name: "Explorer les départements de montagne" })
    .click()
  await expect(page).toHaveURL(/\/connexion\?next=/)
  const next = new URL(
    new URL(page.url()).searchParams.get("next")!,
    "http://localhost",
  )
  expect(next.searchParams.get("dept")?.split(",")).toContain("74")
})

test("accueil — la recherche connectée rejoint le catalogue filtré", async ({
  asCandidate,
}) => {
  await asCandidate.goto("/")
  await asCandidate
    .getByRole("combobox", { name: "Métier", exact: true })
    .selectOption("serveur")
  await asCandidate.getByRole("checkbox", { name: "Avec logement" }).check()
  await asCandidate.getByRole("button", { name: "Trouver ma saison" }).click()
  await expect(asCandidate).toHaveURL(/\/offres\?/)
  const url = new URL(asCandidate.url())
  expect(url.searchParams.get("metier")).toBe("serveur")
  expect(url.searchParams.get("logement")).toBe("oui")
})

test("accueil — les réponses sont accessibles au clavier", async ({ page }) => {
  await page.goto("/")
  const question = page
    .locator("summary")
    .filter({ hasText: "Est-ce gratuit pour les candidats ?" })
  await question.focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByText(
      "Oui. La création du compte, la recherche d’offres et la candidature sont gratuites.",
      { exact: false },
    ),
  ).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(
    page.getByText(
      "Oui. La création du compte, la recherche d’offres et la candidature sont gratuites.",
      { exact: false },
    ),
  ).not.toBeVisible()
})

test("accueil — les deux parcours et les captures sont accessibles", async ({
  page,
}) => {
  await page.goto("/")
  const tabs = page.getByRole("tablist", {
    name: "Découvrir le logiciel selon mon profil",
  })
  await tabs.getByRole("tab", { name: "Je suis employeur" }).click()
  const employerPanel = page.getByRole("tabpanel", {
    name: "Je suis employeur",
  })
  await expect(
    employerPanel.getByRole("heading", { name: "Fidéliser et réembaucher" }),
  ).toBeVisible()
  await expect(employerPanel.getByText("À venir", { exact: true })).toHaveCount(
    2,
  )

  await tabs.getByRole("tab", { name: "Je suis employeur" }).press("ArrowLeft")
  await expect(
    page.getByRole("tabpanel", { name: "Je suis saisonnier" }),
  ).toBeVisible()

  const preview = page.getByRole("button", {
    name: "Agrandir l’aperçu : L’espace saisonnier : mes offres et mes candidatures",
  })
  await preview.click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("img")).toBeVisible()
  await expect
    .poll(() =>
      dialog
        .getByRole("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await dialog.getByRole("button", { name: "Fermer l’aperçu" }).press("Escape")
  await expect(dialog).not.toBeVisible()
  await expect(preview).toBeFocused()
  await expectNoHorizontalScroll(page)
})
