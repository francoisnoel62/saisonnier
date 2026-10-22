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

// Annonce déposée par cet employeur, à Gérardmer (88), avec le statut et la date limite voulus.
export async function insertDepositedOffer(
  db: Pool,
  email: string,
  {
    title,
    status = "published",
    applicationDeadline = null,
  }: {
    title: string
    status?: "published" | "unpublished"
    applicationDeadline?: string | null
  },
) {
  const {
    rows: [offer],
  } = await db.query<{ id: string }>(
    `insert into offers (origin, status, published_at, validity_confirmed_at, company_id,
       created_by_user_id, title, season, commune_name, commune_insee_code, postal_code,
       department_code, duration_value, duration_unit, application_deadline, apply_email)
     select 'deposited', $2::offer_status, now(), now(), m.company_id, m.user_id, $3, 'winter',
       'Gérardmer', '88196', '88400', '88', 4, 'months', $4::date, 'rh@hotel-e2e.example'
     from company_members m join "user" u on u.id = m.user_id
     where u.email = $1
     returning id`,
    [email, status, title, applicationDeadline],
  )
  if (!offer) throw new Error(`Rattachement introuvable : ${email}`)
  return offer.id
}

// Identifiant d'une annonce par son intitulé (unique dans le test qui la crée).
export async function offerIdByTitle(db: Pool, title: string) {
  const { rows } = await db.query<{ id: string }>(
    "select id from offers where title = $1",
    [title],
  )
  if (rows.length !== 1) {
    throw new Error(`${rows.length} annonce(s) intitulée(s) « ${title} »`)
  }
  return rows[0].id
}
