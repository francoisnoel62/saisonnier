import type { Pool } from "pg"

// Annonce collectée publiée, réduite au minimum, pour les tests qui ont besoin d'une offre réelle.
// Chaque appel crée sa propre source : les deux projets (chromium, mobile) partagent la base.
export async function insertCollectedOffer(
  db: Pool,
  title = "Serveur / serveuse",
) {
  const {
    rows: [company],
  } = await db.query<{ id: string }>(
    "insert into companies (legal_name) values ($1) returning id",
    ["Entreprise E2E"],
  )
  const sourceUrl = `https://www.entreprise-e2e.example/emplois/${crypto.randomUUID()}`
  const {
    rows: [offer],
  } = await db.query<{ id: string }>(
    `insert into offers (origin, status, published_at, company_id, title, season,
       commune_name, department_code, duration_value, duration_unit,
       apply_url, source_url, source_checked_at)
     values ('collected', 'published', now(), $1, $2, 'summer',
       'Lacanau', '33', 3, 'months', $3, $3, now())
     returning id`,
    [company.id, title, sourceUrl],
  )
  return offer.id
}
