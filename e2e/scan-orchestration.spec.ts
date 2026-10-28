import { expect, test } from "./fixtures"
import { SCAN_FIXTURE_PORT } from "./helpers/env"
import { enableScanSource, resetScan } from "./helpers/scan"
import { insertReviewableCandidate } from "./helpers/scan-review"

// Orchestration du scan (plan scan 09) : passage réel en arrière-plan (Vercel Workflow, monde
// local) contre le serveur de fixtures ; aucune source réelle n'est lue.
const fixtures = `http://localhost:${SCAN_FIXTURE_PORT}`
const control = (action: string, query = "") =>
  fetch(`${fixtures}/controle/${action}${query}`, { method: "POST" })
const companyIds: string[] = []

test.beforeEach(async ({ db }) => {
  await control("reinitialiser")
  await resetScan(db)
})
test.afterEach(async ({ db }) => {
  await control("reinitialiser")
  await resetScan(db)
  for (const id of companyIds.splice(0)) {
    await db.query("delete from offers where company_id = $1", [id])
    await db.query("delete from companies where id = $1", [id])
  }
})

test("Scan §6 — recette de livraison progressive", async ({
  asAdmin: page,
  db,
}, testInfo) => {
  // Un seul remplissage initial par base : le parcours se joue sur le bureau.
  test.skip(testInfo.project.name === "mobile", "parcours long, une fois")
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await enableScanSource(db, "fixture")
  await control("suspendre", "?fiche=/jobs/2")

  // 1. L'admin lance le premier remplissage : la réponse n'attend pas la collecte.
  await page.goto("/admin/scan")
  await page
    .getByRole("button", { name: "Lancer le premier remplissage" })
    .click()
  // Première action : la compilation de la Server Action peut prendre du temps en développement.
  await expect(page.getByText(/Premier remplissage lancé/)).toBeVisible({
    timeout: 30_000,
  })
  const {
    rows: [run],
  } = await db.query<{ id: string }>(
    "select id from scan_runs where run_key = 'bootstrap'",
  )

  // 2. Le dossier 1 arrive pendant que la fiche 2 est suspendue ; l'admin le traite.
  await page.goto("/admin/scan/dossiers")
  await page
    .getByRole("link", { name: /Serveur saisonnier fictif 1 — hiver/ })
    .click({ timeout: 90_000 })
  await page.getByRole("button", { name: "Rejeter", exact: true }).click()
  await page.getByRole("button", { name: "Confirmer le rejet" }).click()
  await expect
    .poll(async () => {
      const { rows } = await db.query(
        "select status from scan_candidates where title = $1",
        ["Serveur saisonnier fictif 1 — hiver"],
      )
      return rows[0]?.status
    })
    .toBe("rejected")

  // 3. Un autre dossier est ouvert et annoté ; la fiche 2 est libérée ; la saisie reste intacte.
  const other = await insertReviewableCandidate(db, run.id)
  companyIds.push(other.companyId)
  await page.goto(`/admin/scan/dossiers/${other.candidate.id}`)
  const description = page.getByLabel("Description (facultatif)", {
    exact: true,
  })
  await description.fill("Vérification en cours pendant la collecte")
  await control("liberer", "?fiche=/jobs/2")
  await expect(
    page.getByRole("link", { name: /Serveur saisonnier fictif 2 — hiver/ }),
  ).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(`/admin/scan/dossiers/${other.candidate.id}`)
  await expect(description).toHaveValue(
    "Vérification en cours pendant la collecte",
  )

  // 4. Écran fermé puis rouvert : le passage a continué, dossiers et décision sont retrouvés.
  await page.goto("/admin")
  await expect
    .poll(
      async () => {
        const { rows } = await db.query(
          "select status, delivered_count from scan_runs where id = $1",
          [run.id],
        )
        return rows[0]
      },
      { timeout: 90_000 },
    )
    // Trois fiches livrées par la collecte, plus le dossier inséré par le test (helper).
    .toEqual({ status: "completed", delivered_count: 4 })
  await page.goto("/admin/scan")
  await expect(
    page.getByText("Dossiers livrés pour vérification").locator(".."),
  ).toContainText("4 / 50")
  const { rows: fixtureSource } = await db.query(
    "select status, delivered_count from scan_run_sources where run_id = $1",
    [run.id],
  )
  expect(fixtureSource).toEqual([{ status: "done", delivered_count: 3 }])
  const { rows: decided } = await db.query(
    "select status from scan_candidates where title = $1",
    ["Serveur saisonnier fictif 1 — hiver"],
  )
  expect(decided).toEqual([{ status: "rejected" }])
  await page.getByRole("link", { name: "Bilan" }).click()
  await expect(page).toHaveURL(`/admin/scan/passages/${run.id}`)
  await expect(page.getByText("Fixtures locales")).toBeVisible()
})

test("Scan §3 — la route du scan refuse tout appel sans le secret", async ({
  request,
}) => {
  expect((await request.get("/api/cron/scan")).status()).toBe(401)
  expect(
    (
      await request.get("/api/cron/scan", {
        headers: { authorization: "Bearer faux" },
      })
    ).status(),
  ).toBe(401)
  const authorized = await request.get("/api/cron/scan", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  expect(authorized.status()).toBe(200)
  // Hors créneau ou tâche désactivée : rien ne démarre.
  expect(await authorized.json()).toHaveProperty("skipped")
})
