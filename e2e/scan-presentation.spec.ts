import type { Page } from "@playwright/test"
import type { Pool } from "pg"
import { expect, test } from "./fixtures"
import { insertCollectedOffer } from "./helpers/offers"
import { provenanceLabels, type Provenance } from "../src/domain/offer-labels"

const card = (page: Page, title: string) =>
  page
    .locator("#resultats [data-slot=card]")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) })

async function presentationOffer(
  db: Pool,
  provenance: Provenance,
  external = false,
) {
  const title = `Présentation ${provenance} ${crypto.randomUUID().slice(0, 8)}`
  const id = await insertCollectedOffer(db, title)
  if (provenance === "human_verified")
    await db.query(
      "update offers set human_verified_at = now() where id = $1",
      [id],
    )
  if (provenance === "verified_recruiter" || provenance === "deposited") {
    let userId: string | null = null
    if (provenance === "verified_recruiter") {
      userId = crypto.randomUUID()
      await db.query(
        `insert into "user" (id, name, email, email_verified, role) values ($1, 'Employeur fictif', $2, true, 'employer')`,
        [userId, `${userId}@presentation.example`],
      )
    }
    await db.query(
      "update offers set origin = 'deposited', created_by_user_id = $2, source_url = null, source_checked_at = null where id = $1",
      [id, userId],
    )
  } else
    await db.query(
      "update offers set first_discovered_at = now() where id = $1",
      [id],
    )
  if (!external)
    await db.query(
      "update offers set apply_email = 'rh@presentation.example' where id = $1",
      [id],
    )
  return { id, title }
}

for (const provenance of [
  "human_verified",
  "sourced",
  "verified_recruiter",
  "deposited",
] as const) {
  test(`Scan §7 — labels de provenance sur la carte et la fiche : ${provenance}`, async ({
    asCandidate: page,
    db,
  }) => {
    const { id, title } = await presentationOffer(db, provenance)
    await page.goto("/offres")
    await expect(
      card(page, title).getByText(provenanceLabels[provenance], {
        exact: true,
      }),
    ).toBeVisible()
    await page.goto(`/offres/${id}`)
    await expect(
      page.getByText(provenanceLabels[provenance], { exact: true }),
    ).toBeVisible()
    if (provenance === "sourced") {
      await expect(page.getByText(/sans vérification humaine/)).toBeVisible()
      await expect(page.getByText(/^Découverte le/)).toBeVisible()
    }
  })
}

for (const provenance of ["human_verified", "sourced"] as const) {
  test(`Scan §6 — formulaire seul : badge avant ouverture, provenance ${provenance}`, async ({
    newCandidate,
    db,
  }) => {
    const { page } = await newCandidate("presentation")
    const { id, title } = await presentationOffer(db, provenance, true)
    await page.goto("/offres")
    await expect(
      card(page, title).getByText("Candidature externe", { exact: true }),
    ).toBeVisible()
    await page.goto(`/offres/${id}`)
    await expect(
      page.getByText("Candidature externe", { exact: true }),
    ).toHaveCount(2)
    await expect(
      page.getByText(
        "La candidature se fait sur le formulaire officiel de l'employeur.",
      ),
    ).toBeVisible()
    await expect(
        page.getByRole("link", { name: "Compléter mon dossier" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Site officiel :/ }),
    ).toHaveCount(0)
    await expect(
      page.getByText(provenanceLabels[provenance], { exact: true }),
    ).toBeVisible()
  })
}

test("Scan §5 — logement à confirmer : indication et exclusion du filtre logement", async ({
  asCandidate: page,
  db,
}) => {
  const { id, title } = await presentationOffer(db, "sourced")
  await db.query(
    "update offers set fields_to_confirm = '{housing,salary}', housing_details = 'Informations contradictoires à la source.', salary_notes = 'Base à vérifier.', additional_info = 'Accueil à partir de 16 h.' where id = $1",
    [id],
  )
  await page.goto("/offres")
  await expect(
    card(page, title).getByText("À confirmer", { exact: true }),
  ).toBeVisible()
  await page.goto(`/offres/${id}`)
  await expect(page.getByText("À confirmer", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Salaire à confirmer", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Divers", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Accueil à partir de 16 h.")).toBeVisible()
  await page.goto("/offres?logement=oui")
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0)
})
