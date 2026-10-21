import { navigation, secondaryNavigation } from "../src/config/navigation"
import { accounts, PASSWORD, roles, type TestRole } from "./accounts"
import { expect, test } from "./fixtures"
import { expectNoHorizontalScroll, openMenu } from "./helpers/shell"
import { signIn } from "./helpers/sign-in"

test("shell — l'utilisateur connecté s'affiche dans le menu et la déconnexion fonctionne", async ({
  page,
}) => {
  // Connexion dédiée : se déconnecter révoque la session, pas celle des fixtures.
  const { name, email } = accounts.candidate
  await signIn(page, "candidate")

  await openMenu(page)
  await page.getByRole("button", { name: new RegExp(email) }).click()
  await expect(page.getByRole("menu").getByText(name)).toBeVisible()
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click()

  await expect(page).toHaveURL("/connexion")
  await page.goto("/offres")
  await expect(page).toHaveURL(/\/connexion\?next=%2Foffres$/)
})

test("shell — le titre de l'en-tête suit la page", async ({ asEmployer }) => {
  await asEmployer.goto("/employeur/annonces/nouvelle")
  await expect(
    asEmployer.getByRole("heading", { level: 1, name: "Déposer une annonce" }),
  ).toBeVisible()
  await expect(asEmployer.getByText("Bientôt disponible")).toBeVisible()
})

test("compte — nom et email sont en lecture seule", async ({ asEmployer }) => {
  await asEmployer.goto("/compte")
  const { name, email } = accounts.employer
  await expect(asEmployer.getByLabel("Nom")).toHaveValue(name)
  await expect(asEmployer.getByLabel("Nom")).toHaveAttribute("readonly", "")
  await expect(asEmployer.getByLabel("Adresse email")).toHaveValue(email)
  await expect(asEmployer.getByLabel("Adresse email")).toHaveAttribute(
    "readonly",
    "",
  )
})

test("compte — un mauvais mot de passe actuel est refusé", async ({
  asCandidate,
}) => {
  await asCandidate.goto("/compte")
  await asCandidate
    .getByLabel("Mot de passe actuel")
    .fill("pas-le-bon-mot-de-passe")
  await asCandidate
    .getByLabel("Nouveau mot de passe", { exact: true })
    .fill("nouveau-mot-de-passe-1")
  await asCandidate
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill("nouveau-mot-de-passe-1")
  await asCandidate
    .getByRole("button", { name: "Modifier le mot de passe" })
    .click()
  await expect(
    asCandidate.getByText("Le mot de passe actuel est incorrect."),
  ).toBeVisible()
})

test("compte — deux nouveaux mots de passe différents sont refusés", async ({
  asCandidate,
}) => {
  await asCandidate.goto("/compte")
  await asCandidate.getByLabel("Mot de passe actuel").fill(PASSWORD)
  await asCandidate
    .getByLabel("Nouveau mot de passe", { exact: true })
    .fill("nouveau-mot-de-passe-1")
  await asCandidate
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill("nouveau-mot-de-passe-2")
  await asCandidate
    .getByRole("button", { name: "Modifier le mot de passe" })
    .click()
  await expect(
    asCandidate.getByText("Les deux mots de passe ne correspondent pas."),
  ).toBeVisible()
})

const pages: Record<TestRole, "asCandidate" | "asEmployer" | "asAdmin"> = {
  candidate: "asCandidate",
  employer: "asEmployer",
  admin: "asAdmin",
}

// Mobile d'abord (375 px) : aucune page du shell ne défile horizontalement.
for (const role of roles) {
  test(`shell — aucune page du rôle ${role} ne défile horizontalement`, async ({
    asCandidate,
    asEmployer,
    asAdmin,
  }) => {
    const page = { asCandidate, asEmployer, asAdmin }[pages[role]]
    const urls = [...navigation[role], ...secondaryNavigation].map(
      (item) => item.url,
    )
    for (const url of new Set(urls)) {
      await page.goto(url)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })
}
