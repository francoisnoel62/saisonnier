import { expect, type Page } from "@playwright/test"

// Un PDF minimal mais valide pour la route d'envoi (signature %PDF-), reconnaissable à son texte.
export function pdfFile(text: string, name = "cv.pdf") {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`),
  }
}

// Le formulaire n'envoie rien tant qu'il n'est pas hydraté.
export async function openDossier(page: Page) {
  await page.goto("/dossier", { waitUntil: "networkidle" })
}

export async function uploadCv(page: Page, file: ReturnType<typeof pdfFile>) {
  await page.getByLabel(/^(Ajouter|Remplacer) mon CV/).setInputFiles(file)
  await expect(page.getByText(file.name, { exact: true })).toBeVisible()
}

// Téléphone et CV : avec le nom du compte, le dossier est complet (H3).
// Déjà sur /dossier (arrivée depuis une fiche, avec ?retour=), la page est gardée.
export async function completeDossier(page: Page, label: string) {
  if (new URL(page.url()).pathname === "/dossier") {
    await page.waitForLoadState("networkidle")
  } else {
    await openDossier(page)
  }
  await page.getByLabel("Téléphone").fill("06 39 98 12 34")
  await page
    .getByRole("button", { name: "Enregistrer mes coordonnées" })
    .click()
  await expect(page.getByText("Coordonnées enregistrées.")).toBeVisible()
  await uploadCv(page, pdfFile(`CV de ${label}`, `cv-${label}.pdf`))
  await expect(page.getByText("Votre dossier est complet")).toBeVisible()
}
