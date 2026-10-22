import { randomUUID } from "node:crypto"

import type { Page } from "@playwright/test"
import type { Pool } from "pg"

import { expect, test } from "./fixtures"
import { insertMembership } from "./helpers/company"
import { insertDepositedOffer } from "./helpers/offers"
import { expectEmail } from "./helpers/outbox"

// Cycle de vie des annonces : route cron, rappel de validité et lien signé (plan 16).

const CRON = "/api/cron/quotidien"

// Un intitulé propre au test : les deux projets (chromium, mobile) partagent la base.
const uniqueTitle = (label: string) => `${label} ${randomUUID().slice(0, 8)}`

const offerRow = (page: Page, title: string) =>
  page.getByRole("row").filter({ hasText: title })

// « 22 octobre 2026 », comme formatDate.
const longDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date)

// Annonce publiée et confirmée il y a `days` jours : un rappel est dû au-delà de 30.
async function ageOffer(db: Pool, offerId: string, days: number) {
  await db.query(
    `update offers set published_at = now() - make_interval(days => $2),
       validity_confirmed_at = now() - make_interval(days => $2)
     where id = $1`,
    [offerId, days],
  )
}

test("§6 — la route cron refuse tout appel sans le secret", async ({
  request,
}) => {
  expect((await request.get(CRON)).status()).toBe(401)
  const wrong = await request.get(CRON, {
    headers: { authorization: "Bearer pas-le-bon-secret" },
  })
  expect(wrong.status()).toBe(401)
})

test("§6 — le lien signé du rappel, puis « toujours valable », met à jour la date affichée côté employeur", async ({
  newEmployer,
  page: anonymous,
  request,
  db,
}) => {
  const { page, email } = await newEmployer("rappel")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Barman rappel")
  const offerId = await insertDepositedOffer(db, email, { title })
  await ageOffer(db, offerId, 31)

  const response = await request.get(CRON, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  expect(response.ok()).toBe(true)
  const summary = await response.json()
  expect(summary.reminders.sent).toBeGreaterThanOrEqual(1)

  const reminder = await expectEmail(
    email,
    `Votre annonce « ${title} » est-elle toujours valable ?`,
  )
  const link = /https?:\/\/\S+\/annonce\/confirmer\/[\w.-]+/.exec(
    reminder.text,
  )?.[0]
  expect(link).toBeDefined()

  // Sans réponse, l'annonce reste en ligne ; l'espace employeur pose la question.
  await page.goto("/employeur/annonces")
  const row = offerRow(page, title)
  await expect(row.getByText("En ligne")).toBeVisible()
  await expect(row.getByText("Toujours valable ?")).toBeVisible()

  // Ouvrir le lien n'agit pas : seul le bouton répond.
  await anonymous.goto(new URL(link!).pathname, { waitUntil: "networkidle" })
  await expect(
    anonymous.getByRole("heading", {
      name: "Votre annonce est-elle toujours valable ?",
    }),
  ).toBeVisible()
  await expect(anonymous.getByText(title)).toBeVisible()
  const {
    rows: [before],
  } = await db.query(
    "select validity_confirmed_at < now() - interval '30 days' as old from offers where id = $1",
    [offerId],
  )
  expect(before.old).toBe(true)

  await anonymous.getByRole("button", { name: "Oui, toujours valable" }).click()
  await expect(
    anonymous.getByText("Merci : votre annonce reste en ligne."),
  ).toBeVisible()

  await page.reload()
  await expect(row.getByText("Toujours valable ?")).toHaveCount(0)
  await expect(row).toContainText(longDate(new Date()))
})

test("§6 — depuis l'espace employeur, « Non, retirer l'annonce » la met hors ligne", async ({
  newEmployer,
  db,
}) => {
  const { page, email } = await newEmployer("rappel-retrait")
  await insertMembership(db, email, "verified")
  const title = uniqueTitle("Plongeur rappel")
  const offerId = await insertDepositedOffer(db, email, { title })
  await ageOffer(db, offerId, 35)
  // Rappel envoyé hier, resté sans réponse.
  await db.query(
    "update offers set validity_reminder_sent_at = now() - interval '1 day' where id = $1",
    [offerId],
  )

  await page.goto("/employeur/annonces", { waitUntil: "networkidle" })
  const question = page.getByRole("group", {
    name: `Toujours valable ? « ${title} »`,
  })
  await question.getByRole("button", { name: "Non, retirer l’annonce" }).click()
  await expect(
    page.getByText(
      `« ${title} » est hors ligne : les candidats ne la voient plus.`,
    ),
  ).toBeVisible()
  await expect(offerRow(page, title).getByText("Hors ligne")).toBeVisible()
  await expect(question).toHaveCount(0)
})

test("§6 — un lien altéré n'agit pas et propose de se connecter", async ({
  page,
}) => {
  await page.goto("/annonce/confirmer/pas-un-jeton.signature")
  await expect(
    page.getByRole("heading", { name: "Lien invalide" }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Se connecter" }),
  ).toHaveAttribute("href", "/connexion?next=%2Femployeur%2Fannonces")
  await expect(
    page.getByRole("button", { name: /toujours valable/ }),
  ).toHaveCount(0)
})
