import { randomUUID } from "node:crypto"

import { absent } from "../src/domain/scan/field"
import { expect, test } from "./fixtures"
import { insertScanRun, resetScan } from "./helpers/scan"
import { insertReviewableCandidate } from "./helpers/scan-review"
import { expectNoHorizontalScroll } from "./helpers/shell"

const companyIds: string[] = []
test.beforeEach(async ({ db }) => {
  await resetScan(db)
})
test.afterEach(async ({ db }) => {
  await resetScan(db)
  for (const id of companyIds.splice(0)) {
    await db.query("delete from offers where company_id = $1", [id])
    await db.query("delete from companies where id = $1", [id])
  }
})

test("Scan — un dossier livré pendant le passage apparaît et se publie sans modification", async ({
  asAdmin: page,
  db,
}) => {
  const run = await insertScanRun(db, { status: "running" })
  await page.goto("/admin/scan/dossiers")
  await expect(page.getByText("Recherche en cours…")).toBeVisible()
  const inserted = await insertReviewableCandidate(db, run.id)
  companyIds.push(inserted.companyId)
  await page
    .getByRole("link", { name: new RegExp(inserted.title) })
    .click({ timeout: 10_000 })
  await expect(
    page.getByLabel("Description (facultatif)", { exact: true }),
  ).not.toHaveValue("")
  await expectNoHorizontalScroll(page)
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(page).toHaveURL("/admin/scan/dossiers")
  await expect(
    page.getByText("Annonce publiée — vérifiée par un humain"),
  ).toBeVisible()
  const {
    rows: [offer],
  } = await db.query(
    "select status, human_verified_at, human_verified_by_user_id from offers where company_id = $1",
    [inserted.companyId],
  )
  expect(offer.status).toBe("published")
  expect(offer.human_verified_at).not.toBeNull()
  expect(offer.human_verified_by_user_id).not.toBeNull()
  await page.goto("/admin")
  await page.goto(`/admin/scan/dossiers/${inserted.candidate.id}`)
  await expect(
    page.getByRole("link", { name: "Voir l’annonce publiée" }),
  ).toBeVisible()
})

test("Scan — une arrivée et un échec d'actualisation ne remplacent ni le dossier ouvert ni la saisie", async ({
  asAdmin: page,
  db,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const run = await insertScanRun(db, { status: "running" })
  const first = await insertReviewableCandidate(db, run.id)
  companyIds.push(first.companyId)
  await page.goto(`/admin/scan/dossiers/${first.candidate.id}`)
  await page
    .getByLabel("Description (facultatif)", { exact: true })
    .fill("Ma description en cours de vérification")
  await expect(
    page.getByLabel("Description (facultatif)", { exact: true }),
  ).toHaveValue("Ma description en cours de vérification")
  let failed = false
  await page.route("**/api/admin/scan/etat?**", async (route) => {
    if (!failed) {
      failed = true
      await route.fulfill({ status: 500, body: "Erreur temporaire" })
    } else await route.continue()
  })
  const second = await insertReviewableCandidate(db, run.id)
  companyIds.push(second.companyId)
  await expect(page.getByText(/Actualisation interrompue/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByRole("link", { name: new RegExp(second.title) }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(`/admin/scan/dossiers/${first.candidate.id}`)
  await expect(
    page.getByLabel("Description (facultatif)", { exact: true }),
  ).toHaveValue("Ma description en cours de vérification")
})

test("Scan — un lieu absent bloque la validation ; été/hiver absent reste facultatif", async ({
  asAdmin: page,
  db,
}) => {
  const run = await insertScanRun(db, { status: "running" })
  const missing = await insertReviewableCandidate(db, run.id, {
    proposalPatch: { locations: absent() },
  })
  companyIds.push(missing.companyId)
  await page.goto(`/admin/scan/dossiers/${missing.candidate.id}`)
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(
    page.getByText("Indiquez la commune du poste.", { exact: true }),
  ).toBeVisible()
  expect(
    (
      await db.query("select status from scan_candidates where id = $1", [
        missing.candidate.id,
      ])
    ).rows[0].status,
  ).toBe("to_review")
  const complete = await insertReviewableCandidate(db, run.id, {
    proposalPatch: { season: absent() },
  })
  companyIds.push(complete.companyId)
  await page.goto(`/admin/scan/dossiers/${complete.candidate.id}`)
  await expect(page.getByLabel("Non précisée", { exact: true })).toBeChecked()
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(page).not.toHaveURL(
    `/admin/scan/dossiers/${complete.candidate.id}`,
  )
  const {
    rows: [offer],
  } = await db.query(
    "select status, season from offers where company_id = $1",
    [complete.companyId],
  )
  expect(offer).toMatchObject({ status: "published", season: null })
})

test("Scan — un métier inconnu ne bloque pas la publication et une suggestion rejetée ne revient pas", async ({
  asAdmin: page,
  db,
}) => {
  const run = await insertScanRun(db, { status: "running" })
  const title = `Métier inconnu ${randomUUID().slice(0, 8)}`
  const inserted = await insertReviewableCandidate(db, run.id, {
    title,
    suggestion: true,
  })
  companyIds.push(inserted.companyId)
  await page.goto(`/admin/scan/dossiers/${inserted.candidate.id}`)
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(
    page.getByText("Annonce publiée — vérifiée par un humain"),
  ).toBeVisible()
  await page.goto("/admin/scan/suggestions")
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Rejeter la suggestion", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0)
  const second = await insertReviewableCandidate(db, run.id, {
    title,
    suggestion: true,
  })
  companyIds.push(second.companyId)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0)
})

test("Scan — un doublon potentiel attend une décision et l'autre annonce reste intacte", async ({
  asAdmin: page,
  db,
}) => {
  const run = await insertScanRun(db, { status: "running" })
  const inserted = await insertReviewableCandidate(db, run.id)
  companyIds.push(inserted.companyId)
  const {
    rows: [other],
  } = await db.query<{ id: string }>(
    "insert into offers (origin, status, company_id, title, season, commune_name, department_code, duration_value, duration_unit, apply_email, published_at) values ('deposited','published',$1,'Autre recrutement','winter','Chamonix','74',4,'months','rh@hotel.example',now()) returning id",
    [inserted.companyId],
  )
  await db.query(
    "insert into scan_reviews (kind, group_key, candidate_id, offer_id) values ('duplicate',$1,$2,$3)",
    [randomUUID(), inserted.candidate.id, other.id],
  )
  await page.goto(`/admin/scan/dossiers/${inserted.candidate.id}`)
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(
    page.getByText(/Publication impossible : Doublon potentiel/),
  ).toBeVisible()
  await page
    .getByRole("button", {
      name: "Ce sont deux recrutements distincts",
      exact: true,
    })
    .click()
  await expect(
    page.getByText("Recrutements distincts : décision enregistrée."),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click()
  await expect(page).toHaveURL("/admin/scan/dossiers")
  expect(
    (
      await db.query("select title, origin, status from offers where id = $1", [
        other.id,
      ])
    ).rows[0],
  ).toEqual({
    title: "Autre recrutement",
    origin: "deposited",
    status: "published",
  })
})

test("Scan — API d'état réservée à l'admin, sans cache ni coordonnées", async ({
  request,
  asCandidate,
  asAdmin,
  db,
}) => {
  const run = await insertScanRun(db, { status: "running" })
  const inserted = await insertReviewableCandidate(db, run.id)
  companyIds.push(inserted.companyId)
  expect((await request.get("/api/admin/scan/etat")).status()).toBe(401)
  expect((await asCandidate.request.get("/api/admin/scan/etat")).status()).toBe(
    403,
  )
  const response = await asAdmin.request.get("/api/admin/scan/etat")
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  const body = await response.json()
  expect(body.items).toHaveLength(1)
  expect(body.items[0]).not.toHaveProperty("pageText")
  expect(body.items[0]).not.toHaveProperty("proposal")
  expect(JSON.stringify(body)).not.toContain("recrutement@hotel.example")
})
