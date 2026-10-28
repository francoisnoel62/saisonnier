import { expect, test } from "./fixtures"
import {
  deleteTestSources,
  insertScanCandidate,
  insertScanRun,
  insertTestSource,
} from "./helpers/scan"
import { SCAN_FIXTURE_PORT } from "./helpers/env"
import { expectNoHorizontalScroll } from "./helpers/shell"

test("Scan — la page du scan est réservée à l'admin", async ({
  asCandidate,
  asEmployer,
}) => {
  await asCandidate.goto("/admin/scan")
  await expect(asCandidate).toHaveURL("/offres")
  await asEmployer.goto("/admin/scan")
  await expect(asEmployer).toHaveURL("/employeur")
})

test("Sources — la gestion des sources est réservée à l'admin", async ({
  asCandidate,
  asEmployer,
}) => {
  for (const path of [
    "/admin/scan/sources",
    "/admin/scan/sources/fixture",
    "/admin/scan/sources/fixture/modifier",
  ]) {
    await asCandidate.goto(path)
    await expect(asCandidate).toHaveURL("/offres")
    await asEmployer.goto(path)
    await expect(asEmployer).toHaveURL("/employeur")
  }
})

test("Scan — sources résumées sur /admin/scan, liste ordonnée sur mobile", async ({
  asAdmin,
}) => {
  await asAdmin.setViewportSize({ width: 375, height: 812 })
  await asAdmin.goto("/admin/scan")
  await expect(
    asAdmin.getByRole("heading", { level: 1, name: "Scan", exact: true }),
  ).toBeVisible()
  await expect(
    asAdmin.getByRole("heading", { name: "Sources du scan" }),
  ).toBeVisible()
  await asAdmin.getByRole("link", { name: "Gérer les sources" }).click()
  await expect(
    asAdmin.getByRole("heading", { level: 1, name: "Sources du scan" }),
  ).toBeVisible()
  await expect(asAdmin.getByText(/^\d+ sources?$/)).toBeVisible()
  const cards = asAdmin.locator("ul.md\\:hidden > li")
  await expect(
    cards.first().getByRole("link", { name: "France Travail" }),
  ).toBeVisible()
  await expect(cards.first().getByText("Prête", { exact: true })).toBeVisible()
  const belambra = cards.filter({
    has: asAdmin.getByRole("link", { name: "Belambra", exact: true }),
  })
  await expect(belambra.getByText(/À qualifier/)).toBeVisible()
  // Les pistes écartées du plan 01 sont dans l'onglet « Écartées ».
  await asAdmin.getByLabel("Statut").click()
  await asAdmin.getByRole("option", { name: "Écartées" }).click()
  await expect(asAdmin).toHaveURL(/statut=ecartees/)
  await expect(cards).toHaveCount(3)
  await expect(
    cards.getByRole("link", { name: "Sandaya (WeRecruit)" }),
  ).toBeVisible()
  await expectNoHorizontalScroll(asAdmin)
})

test("Scan — la sonde affiche la liste et trois fiches dans un panneau accessible", async ({
  asAdmin,
}) => {
  await asAdmin.setViewportSize({ width: 375, height: 812 })
  await asAdmin.goto("/admin/scan/sources/fixture")
  const trigger = asAdmin.getByRole("button", {
    name: /Tester l’accès.*Fixtures locales/,
  })
  await trigger.click()
  const sheet = asAdmin.getByRole("dialog", {
    name: "Diagnostic — Fixtures locales",
  })
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Liste — Accessible" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    sheet.getByRole("heading", { name: "Fiche — Accessible" }),
  ).toHaveCount(3)
  await expect(sheet.getByText(/robots.txt : autorisé/)).toHaveCount(4)
  await expectNoHorizontalScroll(asAdmin)
  await asAdmin.keyboard.press("Escape")
  await expect(sheet).not.toBeVisible()
  await expect(trigger).toBeFocused()
  // Le test est conservé dans l'onglet « Tests », avec l'empreinte de la configuration.
  await asAdmin.goto("/admin/scan/sources/fixture?onglet=tests")
  await expect(
    asAdmin.getByRole("heading", { name: "Test d’accès — réussi" }).first(),
  ).toBeVisible()
  await expect(
    asAdmin.getByText("Configuration actuelle").first(),
  ).toBeVisible()
})

test("Scan — l'échantillon affiche les champs établis sans créer de dossier", async ({
  asAdmin,
  db,
}) => {
  const before = await db.query<{ count: string }>(
    "select count(*) from scan_candidates",
  )
  await asAdmin.goto("/admin/scan/sources/fixture")
  // Délai de recharge de 30 s entre deux tests d'une même source.
  await db.query(
    "update scan_source_events set created_at = created_at - interval '1 minute' where source_key = 'fixture'",
  )
  await asAdmin
    .getByRole("button", { name: /Extraire un échantillon.*Fixtures locales/ })
    .click()
  const sheet = asAdmin.getByRole("dialog", {
    name: "Échantillon — Fixtures locales",
  })
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Champs établis dans l’échantillon" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(sheet.getByText("Contrat : 3/3", { exact: true })).toBeVisible()
  await expect(sheet.getByRole("link", { name: "Fiche source" })).toHaveCount(3)
  await expectNoHorizontalScroll(asAdmin)
  const after = await db.query<{ count: string }>(
    "select count(*) from scan_candidates",
  )
  expect(after.rows[0].count).toBe(before.rows[0].count)
})

test("Sources — une source non qualifiée ne s'active pas et dit pourquoi", async ({
  asAdmin,
}) => {
  await asAdmin.goto("/admin/scan/sources/belambra")
  const enabled = asAdmin.getByRole("switch", { name: "Activée", exact: true })
  await expect(enabled).toBeDisabled()
  await expect(enabled).toHaveAccessibleDescription(/À qualifier/)
  await asAdmin.getByRole("link", { name: "Qualification" }).click()
  await expect(
    asAdmin.getByText(/Manquant : Décision de reprise/),
  ).toBeAttached()
  await expect(
    asAdmin
      .getByText(/robots.txt ne vaut pas autorisation de republier/)
      .first(),
  ).toBeVisible()
  await expect(
    asAdmin.getByRole("button", { name: "Marquer comme prête" }),
  ).toBeDisabled()
  // Une découverte ne publie jamais automatiquement.
  await asAdmin.goto("/admin/scan/sources/france-travail")
  const auto = asAdmin.getByRole("switch", {
    name: "Publication automatique (passages quotidiens)",
  })
  await expect(auto).toBeDisabled()
  await expect(auto).toHaveAccessibleDescription(/ne publie jamais/)
})

test("Sources — modifier une source prête exige un test de la nouvelle configuration", async ({
  asAdmin,
  db,
}) => {
  try {
    const key = await insertTestSource(db, {
      label: "E2E — Portail prêt",
      status: "ready",
      origin: "http://localhost:3999",
    })
    await asAdmin.goto(`/admin/scan/sources/${key}/modifier`)
    const origin = asAdmin.getByLabel("Origine de test")
    const expected = `http://localhost:${SCAN_FIXTURE_PORT}`
    await origin.fill(expected)
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(
      asAdmin.getByText(
        "Testez ces réglages avant de les enregistrer sur une source prête.",
      ),
    ).toBeVisible()
    await expect(origin).toHaveValue(expected)
    await asAdmin.getByRole("button", { name: "Tester ces réglages" }).click()
    const sheet = asAdmin.getByRole("dialog", { name: /Échantillon —/ })
    await expect(sheet.getByText("Test réussi", { exact: false })).toBeVisible({
      timeout: 30_000,
    })
    await asAdmin.keyboard.press("Escape")
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(asAdmin).toHaveURL(
      new RegExp(`/admin/scan/sources/${key}\\?onglet=historique`),
    )
    await expect(
      asAdmin.getByRole("heading", { name: "Version 2" }),
    ).toBeVisible()
  } finally {
    await deleteTestSources(db)
  }
})

test("Sources — conflit de modification : la saisie est conservée", async ({
  asAdmin,
  db,
}) => {
  try {
    const key = await insertTestSource(db, { label: "E2E — Conflit" })
    await asAdmin.goto(`/admin/scan/sources/${key}/modifier`)
    const label = asAdmin.getByLabel("Libellé")
    await label.fill("E2E — Conflit renommé")
    await db.query(
      "update scan_sources set version = version + 1 where key = $1",
      [key],
    )
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(
      asAdmin.getByText(
        "La source a été modifiée entre-temps. Rechargez : votre saisie est conservée.",
      ),
    ).toBeVisible()
    await expect(label).toHaveValue("E2E — Conflit renommé")
  } finally {
    await deleteTestSources(db)
  }
})

test("Sources — historique : qui a changé quoi, et retour à une version", async ({
  asAdmin,
  db,
}) => {
  try {
    const key = await insertTestSource(db, { label: "E2E — Historique" })
    await asAdmin.goto(`/admin/scan/sources/${key}/modifier`)
    await asAdmin.getByLabel("Libellé").fill("E2E — Historique renommé")
    await asAdmin.getByLabel("Motif").fill("Nouveau nom de l'employeur.")
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(
      asAdmin.getByRole("heading", { name: "Version 2" }),
    ).toBeVisible()
    const version2 = asAdmin.locator("li").filter({
      has: asAdmin.getByRole("heading", { name: "Version 2" }),
    })
    await expect(version2.getByText(/Alix Admin/)).toBeVisible()
    await expect(
      version2.getByText("Motif : Nouveau nom de l'employeur."),
    ).toBeVisible()
    await expect(version2.getByText(/Champs modifiés : Libellé/)).toBeVisible()
    await asAdmin
      .getByRole("button", { name: "Revenir à cette version (1)" })
      .click()
    await expect(
      asAdmin.getByRole("heading", { name: "Version 3" }),
    ).toBeVisible()
    await expect(
      asAdmin
        .locator("li")
        .filter({ has: asAdmin.getByRole("heading", { name: "Version 3" }) })
        .getByText("Actuelle"),
    ).toBeVisible()
    await expect(
      asAdmin.getByRole("heading", { level: 2, name: "E2E — Historique" }),
    ).toBeVisible()
  } finally {
    await deleteTestSources(db)
  }
})

test("Sources — archiver conserve les dossiers, supprimer exige l'absence d'historique", async ({
  asAdmin,
  db,
}) => {
  try {
    const cited = await insertTestSource(db, { label: "E2E — Avec historique" })
    const run = await insertScanRun(db, {
      mode: "daily",
      startedAt: new Date("2020-01-01T10:00:00Z"),
      status: "completed",
      finishedAt: new Date("2020-01-01T11:00:00Z"),
    })
    const candidate = await insertScanCandidate(db, {
      sourceKey: cited,
      firstRunId: run.id,
      status: "to_review",
    })
    await asAdmin.goto(`/admin/scan/sources/${cited}`)
    await asAdmin
      .getByRole("button", { name: "Supprimer", exact: true })
      .click()
    const remove = asAdmin.getByRole("dialog", {
      name: "Supprimer « E2E — Avec historique »",
    })
    await remove
      .getByRole("button", { name: "Supprimer définitivement" })
      .click()
    await expect(
      remove.getByText("Cette source a un historique : archivez-la."),
    ).toBeVisible()
    await remove.getByRole("button", { name: "Archiver" }).click()
    const archive = asAdmin.getByRole("dialog", {
      name: "Archiver « E2E — Avec historique »",
    })
    await expect(
      archive.getByText(/Ses dossiers restent consultables et traitables/),
    ).toBeVisible()
    await archive.getByRole("button", { name: "Archiver la source" }).click()
    await expect(asAdmin.getByText("Archivée", { exact: true })).toBeVisible()
    const { rows } = await db.query(
      "select status from scan_candidates where id = $1",
      [candidate.id],
    )
    expect(rows).toEqual([{ status: "to_review" }])

    const fresh = await insertTestSource(db, { label: "E2E — Sans historique" })
    await asAdmin.goto(`/admin/scan/sources/${fresh}`)
    await asAdmin
      .getByRole("button", { name: "Supprimer", exact: true })
      .click()
    await asAdmin
      .getByRole("dialog", { name: "Supprimer « E2E — Sans historique »" })
      .getByRole("button", { name: "Supprimer définitivement" })
      .click()
    await expect(asAdmin).toHaveURL("/admin/scan/sources")
    const { rowCount } = await db.query(
      "select 1 from scan_sources where key = $1",
      [fresh],
    )
    expect(rowCount).toBe(0)
  } finally {
    await deleteTestSources(db)
    await db.query("delete from scan_runs where run_key = 'daily:2020-01-01'")
  }
})

test("Sources — liste et fiche à 375 px sans défilement horizontal", async ({
  asAdmin,
}) => {
  await asAdmin.setViewportSize({ width: 375, height: 812 })
  await asAdmin.goto("/admin/scan/sources")
  await expectNoHorizontalScroll(asAdmin)
  for (const tab of ["configuration", "qualification", "tests", "historique"]) {
    await asAdmin.goto(`/admin/scan/sources/vvf?onglet=${tab}`)
    await expect(
      asAdmin.getByRole("heading", { level: 2, name: "VVF" }),
    ).toBeVisible()
    await expectNoHorizontalScroll(asAdmin)
  }
  await asAdmin.goto("/admin/scan/sources/vvf/modifier")
  await expect(asAdmin.getByLabel("Adresse du portail")).toHaveValue(
    "https://vvfrecrute.factorial.fr",
  )
  await expectNoHorizontalScroll(asAdmin)
})
