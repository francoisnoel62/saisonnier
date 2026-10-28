import { expect, test } from "./fixtures"
import {
  deleteTestSources,
  insertScanCandidate,
  insertScanRun,
  insertTestSource,
  resetScan,
} from "./helpers/scan"
import { insertDiscoveryCandidate } from "./helpers/scan-review"
import { SCAN_FIXTURE_PORT } from "./helpers/env"
import { expectNoHorizontalScroll } from "./helpers/shell"

// Une source « E2E — … » laissée par un essai interrompu (délai dépassé) ne doit pas décaler
// les clés déduites des libellés lors de la reprise.
test.beforeEach(async ({ db }) => deleteTestSources(db))

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

test("Sources — ajout guidé d'un portail employeur jusqu'à l'activation", async ({
  asAdmin,
  db,
}) => {
  // Parcours complet : détection, modification, décision, échantillon, activation.
  test.setTimeout(90_000)
  const today = new Date().toISOString().slice(0, 10)
  const origin = `http://localhost:${SCAN_FIXTURE_PORT}`
  try {
    await asAdmin.goto("/admin/scan/sources")
    await asAdmin.getByRole("link", { name: "Ajouter une source" }).click()
    await asAdmin.getByLabel("Adresse de départ").fill(`${origin}/`)
    await asAdmin.getByRole("button", { name: "Analyser" }).click()
    await expect(asAdmin.getByText(/Page lue \(HTTP 200\)/)).toBeVisible({
      timeout: 30_000,
    })
    await expect(
      asAdmin.getByRole("radio", { name: /Fixtures locales/ }),
    ).toBeChecked()
    // Annuaire non consulté : l'employeur est saisi à la main.
    await asAdmin.getByLabel("Libellé").fill("E2E — Portail guidé")
    await asAdmin.getByLabel("Employeur", { exact: true }).fill("Employeur E2E")
    await asAdmin.getByLabel("Site officiel de l’employeur").fill(`${origin}/`)
    await asAdmin.getByRole("button", { name: "Créer le brouillon" }).click()
    await expect(asAdmin).toHaveURL(
      /\/admin\/scan\/sources\/e2e-portail-guide\/modifier/,
    )
    await expect(asAdmin.getByText(/Étape 3 sur 6/)).toBeVisible()
    await asAdmin
      .getByLabel("Preuve de rattachement : page consultée")
      .fill(`${origin}/`)
    await asAdmin
      .getByLabel("Ce que montre cette page")
      .fill("Serveur de fixtures du dépôt.")
    await asAdmin.getByLabel("Consultée le", { exact: true }).fill(today)
    await asAdmin
      .getByLabel("Conditions : CGU ou mentions consultées")
      .fill(`${origin}/`)
    await asAdmin
      .getByLabel("Extrait de robots.txt")
      .fill("User-agent: * Allow: /")
    await asAdmin
      .getByLabel("Résumé des conditions")
      .fill("Fixtures anonymisées du dépôt.")
    await asAdmin.getByLabel("Consultées le", { exact: true }).fill(today)
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(
      asAdmin.getByRole("heading", { name: "Version 2" }),
    ).toBeVisible()

    await asAdmin.goto(
      "/admin/scan/sources/e2e-portail-guide?onglet=qualification",
    )
    await asAdmin.getByLabel("Acceptée par le fondateur").check()
    await asAdmin
      .getByLabel("Note")
      .fill("Fixtures du dépôt, acceptées pour le test.")
    await asAdmin
      .getByRole("button", { name: "Enregistrer la décision" })
      .click()
    await expect(
      asAdmin.getByText(/Acceptée par le fondateur le .* par Alix Admin/),
    ).toBeVisible()
    await asAdmin
      .getByRole("button", { name: /Extraire un échantillon/ })
      .click()
    const sheet = asAdmin.getByRole("dialog", { name: /Échantillon —/ })
    await expect(sheet.getByText(/Test réussi/)).toBeVisible({
      timeout: 30_000,
    })
    await asAdmin.keyboard.press("Escape")
    const ready = asAdmin.getByRole("button", { name: "Marquer comme prête" })
    await expect(ready).toBeEnabled()
    await ready.click()
    const enabled = asAdmin.getByRole("switch", {
      name: "Activée",
      exact: true,
    })
    await expect(enabled).toBeEnabled()
    await enabled.click()
    await expect(enabled).toBeChecked()
    // L'interrupteur s'affiche coché tout de suite : attendre l'écriture avant de recharger.
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "select enabled from scan_sources where key = 'e2e-portail-guide'",
            )
          ).rows[0]?.enabled,
        { timeout: 15_000 },
      )
      .toBe(true)
    await asAdmin.reload()
    await expect(
      asAdmin.getByRole("switch", { name: "Activée", exact: true }),
    ).toBeChecked()
  } finally {
    await db.query(
      "update scan_sources set enabled = false, daily_enabled = false, auto_publish = false where label like 'E2E — %'",
    )
    await deleteTestSources(db)
  }
})

test("Sources — une découverte exige son domaine exclu et ne publie jamais automatiquement", async ({
  asAdmin,
  db,
}) => {
  try {
    await asAdmin.goto("/admin/scan/sources/nouvelle")
    await asAdmin.getByRole("button", { name: "Enregistrer sans URL" }).click()
    await asAdmin.getByLabel("Découverte").check()
    await expect(asAdmin.getByLabel("Employeur", { exact: true })).toHaveCount(
      0,
    )
    await asAdmin.getByLabel("Libellé").fill("E2E — JobAnim")
    await asAdmin.getByLabel("Hôte officiel").fill("www.jobanim-e2e.example")
    await asAdmin.getByRole("button", { name: "Créer le brouillon" }).click()
    await expect(asAdmin).toHaveURL(/e2e-jobanim\/modifier/)
    await asAdmin.goto("/admin/scan/sources/e2e-jobanim?onglet=qualification")
    await expect(
      asAdmin.getByText(/Domaine exclu à ajouter pour www.jobanim-e2e.example/),
    ).toBeVisible()
    await asAdmin
      .getByRole("button", {
        name: "Ajouter jobanim-e2e.example aux domaines exclus",
      })
      .click()
    await expect(
      asAdmin.getByText(/Fait : Cohérence avec les domaines exclus/),
    ).toBeAttached()
    await asAdmin.goto("/admin/scan/sources/e2e-jobanim")
    await expect(
      asAdmin.getByText(/un diffuseur n’est jamais l’employeur/),
    ).toBeVisible()
    await expect(
      asAdmin.getByRole("switch", {
        name: "Publication automatique (passages quotidiens)",
      }),
    ).toBeDisabled()
  } finally {
    await deleteTestSources(db)
    await db.query(
      "delete from blocked_domains where domain = 'jobanim-e2e.example'",
    )
  }
})

test("Sources — écarter Indeed sans lecture du site", async ({
  asAdmin,
  db,
}) => {
  try {
    await asAdmin.goto("/admin/scan/sources/nouvelle")
    await asAdmin
      .getByLabel("Adresse de départ")
      .fill("https://fr.indeed.com/emplois?q=serveur")
    await asAdmin.getByRole("button", { name: "Analyser" }).click()
    await expect(
      asAdmin.getByText("Site non lu : fr.indeed.com."),
    ).toBeVisible()
    await expect(
      asAdmin.getByRole("heading", { name: /Plateforme connue : Indeed/ }),
    ).toBeVisible()
    await asAdmin.getByLabel("Libellé").fill("E2E — Indeed")
    await asAdmin
      .getByRole("button", { name: "Enregistrer comme écartée" })
      .click()
    await expect(asAdmin).toHaveURL(/\/admin\/scan\/sources\/e2e-indeed$/)
    await expect(asAdmin.getByText("Écartée", { exact: true })).toBeVisible()
    await expect(
      asAdmin.getByText(/Écartée : Aucun accès de collecte autorisé/),
    ).toBeVisible()
  } finally {
    await deleteTestSources(db)
  }
})

test("Sources — un site carrière générique se configure et s'échantillonne sans code", async ({
  asAdmin,
  db,
}) => {
  test.setTimeout(180_000)
  const today = new Date().toISOString().slice(0, 10)
  const origin = `http://localhost:${SCAN_FIXTURE_PORT}`
  try {
    await asAdmin.goto("/admin/scan/sources/nouvelle")
    await asAdmin.getByLabel("Adresse de départ").fill(`${origin}/carriere`)
    await asAdmin.getByRole("button", { name: "Analyser" }).click()
    const proposal = asAdmin.getByRole("radio", { name: /Page carrière/ })
    await expect(proposal).toBeChecked({ timeout: 30_000 })
    await expect(
      asAdmin.getByText(
        `Motif proposé : ${origin}/carriere/offres/{slug}-{id} (3 liens reconnus).`,
      ),
    ).toBeVisible()
    await asAdmin.getByLabel("Libellé").fill("E2E — Page carrière")
    await asAdmin.getByLabel("Employeur", { exact: true }).fill("Hôtel E2E")
    await asAdmin.getByLabel("Site officiel de l’employeur").fill(`${origin}/`)
    await asAdmin.getByRole("button", { name: "Créer le brouillon" }).click()
    await expect(asAdmin).toHaveURL(/e2e-page-carriere\/modifier/)
    await expect(asAdmin.getByLabel("Motif des fiches")).toHaveValue(
      `${origin}/carriere/offres/{slug}-{id}`,
    )
    await expect(
      asAdmin.getByText(/carriere\/offres\/\[\^\/\?#\]\+-\(\[0-9\]\+\)/),
    ).toBeVisible()
    await asAdmin
      .getByLabel("Preuve de rattachement : page consultée")
      .fill(`${origin}/`)
    await asAdmin
      .getByLabel("Ce que montre cette page")
      .fill("Serveur de fixtures du dépôt.")
    await asAdmin.getByLabel("Consultée le", { exact: true }).fill(today)
    await asAdmin
      .getByLabel("Conditions : CGU ou mentions consultées")
      .fill(`${origin}/`)
    await asAdmin
      .getByLabel("Extrait de robots.txt")
      .fill("User-agent: * Allow: /")
    await asAdmin
      .getByLabel("Résumé des conditions")
      .fill("Fixtures fictives du dépôt.")
    await asAdmin.getByLabel("Consultées le", { exact: true }).fill(today)
    await asAdmin.getByRole("button", { name: "Enregistrer" }).click()
    await expect(
      asAdmin.getByRole("heading", { name: "Version 2" }),
    ).toBeVisible()
    await asAdmin.goto("/admin/scan/sources/e2e-page-carriere")
    await asAdmin
      .getByRole("button", { name: /Extraire un échantillon/ })
      .click()
    const sheet = asAdmin.getByRole("dialog", { name: /Échantillon —/ })
    await expect(sheet.getByText(/Test réussi/)).toBeVisible({
      timeout: 120_000,
    })
    // Trois fiches en page 1, la quatrième après le lien « page suivante ».
    await expect(sheet.getByRole("link", { name: "Fiche source" })).toHaveCount(
      4,
    )
  } finally {
    await deleteTestSources(db)
  }
})

test.describe("Sources — apprentissage depuis la revue", () => {
  test.beforeEach(async ({ db }) => resetScan(db))
  test.afterEach(async ({ db }) => resetScan(db))

  test("Sources — un lieu mémorisé depuis un dossier sert au passage suivant", async ({
    asAdmin,
    db,
  }) => {
    const run = await insertScanRun(db, {
      status: "completed",
      finishedAt: new Date(),
    })
    const candidate = await insertDiscoveryCandidate(db, run.id, {
      employer: "Chalet E2E",
    })
    await asAdmin.goto(`/admin/scan/dossiers/${candidate.id}`)
    await expect(
      asAdmin.getByRole("heading", {
        name: "Mémoriser ce lieu pour France Travail",
      }),
    ).toBeVisible()
    await expect(asAdmin.getByLabel("Nom lu sur la source")).toHaveValue(
      "Les Menuires",
    )
    await asAdmin.getByLabel("Commune vérifiée").fill("Les Belleville")
    await asAdmin.getByLabel("Département", { exact: true }).fill("73")
    await asAdmin.getByLabel("Code INSEE").fill("73257")
    await asAdmin.getByRole("button", { name: "Mémoriser ce lieu" }).click()
    await expect(
      asAdmin.getByText("Lieu mémorisé pour France Travail."),
    ).toBeVisible()
    await asAdmin.goto("/admin/scan/sources/france-travail")
    await expect(
      asAdmin.getByText("« Les Menuires » → Les Belleville (73, INSEE 73257)"),
    ).toBeVisible()
    await asAdmin.goto("/admin/scan/sources/france-travail?onglet=historique")
    await expect(
      asAdmin.getByText(/Motif : Lieu mémorisé depuis le dossier/),
    ).toBeVisible()
  })

  test("Sources — un employeur sans portail devient une piste, puis est marqué invité", async ({
    asAdmin,
    db,
  }) => {
    const run = await insertScanRun(db, {
      status: "completed",
      finishedAt: new Date(),
    })
    const candidate = await insertDiscoveryCandidate(db, run.id, {
      employer: "Chalet E2E sans portail",
    })
    await asAdmin.goto(`/admin/scan/dossiers/${candidate.id}`)
    await asAdmin
      .getByRole("button", {
        name: "Cet employeur n’a pas de portail carrière",
      })
      .click()
    await expect(
      asAdmin.getByText("Employeur ajouté aux employeurs à inviter."),
    ).toBeVisible()
    await asAdmin.goto("/admin/scan/employeurs")
    const lead = asAdmin.locator("li").filter({
      has: asAdmin.getByRole("heading", { name: "Chalet E2E sans portail" }),
    })
    await expect(lead.getByText("1 dossier", { exact: true })).toBeVisible()
    await lead
      .getByLabel("Note")
      .fill("Appel du gérant, invitation envoyée par email.")
    await lead
      .getByRole("button", { name: "Invité à déposer ses annonces" })
      .click()
    await expect(lead.getByText("Invité", { exact: true })).toBeVisible()
    await expect(
      lead.getByText(
        "Invitation : Appel du gérant, invitation envoyée par email.",
      ),
    ).toBeVisible()
    await expectNoHorizontalScroll(asAdmin)
  })

  test("Sources — la couverture d'une découverte se lit sur sa fiche", async ({
    asAdmin,
    db,
  }) => {
    const run = await insertScanRun(db, {
      status: "completed",
      finishedAt: new Date(),
    })
    await insertDiscoveryCandidate(db, run.id, {
      employer: "Hôtel E2E couvert",
      officialUrl: "https://recrute.belambra.fr/jobs/1-serveur",
    })
    await insertDiscoveryCandidate(db, run.id, { employer: "Gîte E2E inconnu" })
    await asAdmin.goto("/admin/scan/sources/france-travail")
    await expect(
      asAdmin.getByRole("heading", { name: "Radar de la découverte" }),
    ).toBeVisible()
    await expect(
      asAdmin.getByText(
        "Couverture des employeurs : 50 % (1 couvert · 0 à inviter · 1 inconnu)",
      ),
    ).toBeVisible()
    await asAdmin.goto("/admin/scan/sources")
    await expect(
      asAdmin.getByText(/0 portail employeur repéré par la découverte/),
    ).toBeVisible()
  })
})

test("Sources — une source bloquée trois fois est suspendue et se reprend après un test", async ({
  asAdmin,
  db,
}) => {
  try {
    // Trois passages quotidiens terminés où la source était bloquée, et l'état que le
    // disjoncteur pose en fin de passage (applyCircuitBreaker, testé en intégration).
    for (const daysAgo of [3, 2, 1]) {
      const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      const run = await insertScanRun(db, {
        mode: "daily",
        startedAt,
        status: "completed",
        finishedAt: startedAt,
      })
      await db.query(
        `insert into scan_run_sources (run_id, source_key, source_revision, status, last_error)
         select $1, key, revision, 'blocked', 'robots.txt refuse la lecture' from scan_sources where key = 'fixture'`,
        [run.id],
      )
    }
    await db.query(
      `update scan_sources set suspended_at = now(), suspension_reason = 'Trois passages consécutifs bloqués (robots.txt, 401 ou 403) : source suspendue.', version = version + 1 where key = 'fixture'`,
    )
    await db.query(
      "update scan_source_events set created_at = created_at - interval '1 hour' where source_key = 'fixture'",
    )
    await asAdmin.goto("/admin/scan/sources/fixture")
    await expect(
      asAdmin.getByText("Source suspendue", { exact: true }),
    ).toBeVisible()
    await expect(
      asAdmin.getByText(/Trois passages consécutifs bloqués/),
    ).toBeVisible()
    await expect(
      asAdmin.getByRole("switch", { name: "Activée", exact: true }),
    ).toBeDisabled()
    await asAdmin.getByRole("button", { name: "Reprendre la source" }).click()
    await expect(asAdmin.getByText(/Testez la source/)).toBeVisible()
    await asAdmin.getByRole("button", { name: /Tester l’accès/ }).click()
    const sheet = asAdmin.getByRole("dialog", { name: /Diagnostic —/ })
    await expect(sheet.getByText(/Test réussi/)).toBeVisible({
      timeout: 30_000,
    })
    await asAdmin.keyboard.press("Escape")
    await asAdmin.getByRole("button", { name: "Reprendre la source" }).click()
    await expect(asAdmin.getByText("Source reprise.")).toBeVisible()
    await expect(
      asAdmin.getByText("Source suspendue", { exact: true }),
    ).toHaveCount(0)
    await asAdmin.goto("/admin/scan/sources/fixture?onglet=activite")
    await expect(
      asAdmin.getByText(/Passage quotidien · Bloquée/).first(),
    ).toBeVisible()
  } finally {
    await resetScan(db)
  }
})
