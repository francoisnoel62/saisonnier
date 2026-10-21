import { homePaths } from "./accounts"
import { expect, test } from "./fixtures"
import {
  completeDossier,
  openDossier,
  pdfFile,
  uploadCv,
} from "./helpers/dossier"
import { insertCollectedOffer } from "./helpers/offers"
import { expectNoHorizontalScroll } from "./helpers/shell"

// Dossier candidat et CV privé (plan 10). Chaque test crée ses propres candidats.

const CV_URL = "/api/dossier/documents/cv"

test("§9 — un nouveau candidat peut rechercher sans CV", async ({
  newCandidate,
  db,
}) => {
  const title = `Offre sans CV ${crypto.randomUUID().slice(0, 8)}`
  await insertCollectedOffer(db, title)
  const { page } = await newCandidate("sans-cv")

  await page.goto("/offres")
  await expect(page.locator("#resultats h3", { hasText: title })).toBeVisible()
  const banner = page.getByRole("alert").filter({
    hasText: "Complétez votre dossier pour pouvoir candidater",
  })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText("votre numéro de téléphone")
  await expect(banner).toContainText("votre CV (PDF)")

  await banner.getByRole("link", { name: "Compléter mon dossier" }).click()
  await expect(page).toHaveURL("/dossier")
  await expect(page.getByText("Dossier incomplet")).toBeVisible()
})

test("§9 — un fichier qui n'est pas un PDF est refusé", async ({
  newCandidate,
}) => {
  const { page } = await newCandidate("pas-pdf")
  await openDossier(page)
  const input = page.getByLabel("Ajouter mon CV (PDF)")
  const notPdf = "Seuls les fichiers PDF sont acceptés."

  // Extension et type annoncés trompeurs : la signature %PDF- manque.
  await input.setInputFiles({
    name: "cv.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("Ceci n'est pas un PDF."),
  })
  await expect(
    page.getByRole("alert").filter({ hasText: notPdf }),
  ).toBeVisible()
  await input.setInputFiles({
    name: "cv.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("%PDF-1.4 mais en texte"),
  })
  await expect(
    page.getByRole("alert").filter({ hasText: notPdf }),
  ).toBeVisible()
  await expect(
    page.getByText("Aucun document pour l’instant.").first(),
  ).toBeVisible()

  // La route refuse elle-même, sans passer par l'interface.
  const response = await page.request.post("/api/dossier/documents?type=cv", {
    multipart: {
      file: {
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from("\x89PNG"),
      },
    },
  })
  expect(response.status()).toBe(415)
  expect((await page.request.get(CV_URL)).status()).toBe(404)
})

test("§9 — un candidat envoie son CV, puis le télécharge", async ({
  newCandidate,
}) => {
  const { page } = await newCandidate("telecharge")
  const file = pdfFile("CV de test, téléchargement", "Mon CV été 2027.pdf")
  await openDossier(page)
  await expect(
    page.getByText(
      "Votre CV reste privé : aucun employeur ne peut le consulter et nous ne l’envoyons jamais à votre place.",
    ),
  ).toBeVisible()

  await uploadCv(page, file)
  await expect(
    page.getByRole("link", { name: "Télécharger" }).first(),
  ).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Télécharger" }).first().click(),
  ])
  expect(download.suggestedFilename()).toBe(file.name)
  const saved = await download.path()
  const { readFile } = await import("node:fs/promises")
  expect(await readFile(saved)).toEqual(file.buffer)

  const response = await page.request.get(CV_URL)
  expect(response.status()).toBe(200)
  expect(response.headers()).toMatchObject({
    "content-type": "application/pdf",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  })
  expect(response.headers()["content-disposition"]).toMatch(/^attachment;/)

  // Un remplacement remplace le fichier téléchargé.
  const replacement = pdfFile("CV remplacé", "cv-v2.pdf")
  await uploadCv(page, replacement)
  expect(await (await page.request.get(CV_URL)).body()).toEqual(
    replacement.buffer,
  )
})

test("§9 — un autre candidat reçoit son propre CV ou une 404, jamais celui d'un autre", async ({
  newCandidate,
}) => {
  const alice = await newCandidate("alice")
  const bruno = await newCandidate("bruno")
  const aliceCv = pdfFile("CV confidentiel d'Alice", "cv-alice.pdf")
  await openDossier(alice.page)
  await uploadCv(alice.page, aliceCv)

  // Bruno n'a pas de CV : la même route lui répond 404.
  const before = await bruno.page.request.get(CV_URL)
  expect(before.status()).toBe(404)
  expect((await before.body()).includes("Alice")).toBe(false)
  // Aucun paramètre ne désigne le document d'un autre.
  for (const url of [
    `${CV_URL}?user=alice`,
    "/api/dossier/documents/cv-alice.pdf",
    "/api/dossier/documents/..%2Fcv",
  ]) {
    const response = await bruno.page.request.get(url)
    expect(response.status()).toBe(404)
  }

  const brunoCv = pdfFile("CV de Bruno", "cv-bruno.pdf")
  await openDossier(bruno.page)
  await uploadCv(bruno.page, brunoCv)
  expect(await (await bruno.page.request.get(CV_URL)).body()).toEqual(
    brunoCv.buffer,
  )
  expect(await (await alice.page.request.get(CV_URL)).body()).toEqual(
    aliceCv.buffer,
  )
})

test("H11 — ni un employeur ni l'admin n'accèdent aux CV", async ({
  asEmployer,
  asAdmin,
  page,
}) => {
  for (const [role, client] of [
    ["employer", asEmployer],
    ["admin", asAdmin],
  ] as const) {
    expect((await client.request.get(CV_URL)).status()).toBe(403)
    expect(
      (await client.request.get("/api/dossier/documents/lettre")).status(),
    ).toBe(403)
    const upload = await client.request.post("/api/dossier/documents?type=cv", {
      multipart: { file: pdfFile("intrus") },
    })
    expect(upload.status()).toBe(403)

    await client.goto("/dossier")
    await expect(client).toHaveURL(homePaths[role])
  }

  // Sans session : 401, aucune redirection vers un document.
  expect((await page.request.get(CV_URL)).status()).toBe(401)
})

test("§5 — le dossier se complète : coordonnées, CV et message", async ({
  newCandidate,
}) => {
  const { page } = await newCandidate("complet")
  await completeDossier(page, "complet")
  await expectNoHorizontalScroll(page)

  const message = page.getByLabel("Message d’accompagnement (facultatif)")
  const text = "Bonjour, je suis disponible tout l'été."
  await message.fill(text)
  // Le compteur suit la saisie (2 000 s'écrit avec une espace insécable).
  await expect(
    page.getByText(new RegExp(`^${text.length} / 2\\s000 caractères$`)),
  ).toBeVisible()
  await page.getByRole("button", { name: "Enregistrer le message" }).click()
  await expect(page.getByText("Message enregistré.")).toBeVisible()

  await page.reload()
  await expect(page.getByLabel("Téléphone")).toHaveValue("06 39 98 12 34")
  await expect(message).toHaveValue(text)

  // Dossier complet : plus de bannière sur la recherche.
  await page.goto("/offres")
  await expect(page.locator("#resultats-nombre")).toBeVisible()
  await expect(
    page.getByText("Complétez votre dossier pour pouvoir candidater"),
  ).toHaveCount(0)

  // Le CV supprimé, le dossier redevient incomplet.
  await openDossier(page)
  await page.getByRole("button", { name: "Supprimer mon CV" }).click()
  await expect(page.getByText("Dossier incomplet")).toBeVisible()
  expect((await page.request.get(CV_URL)).status()).toBe(404)
})
