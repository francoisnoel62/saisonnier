import type { Pool } from "pg"

import { isValidSiren } from "../../src/domain/membership"

// SIREN aléatoire à clé valide : les deux projets (chromium, mobile) partagent la base.
export function randomSiren() {
  const base = String(Math.floor(Math.random() * 1e8)).padStart(8, "0")
  for (let key = 0; key <= 9; key++) {
    if (isValidSiren(`${base}${key}`)) return `${base}${key}`
  }
  throw new Error("Clé de Luhn introuvable")
}

// Compte employeur rattaché à sa propre entreprise, avec le statut voulu. Renvoie l'entreprise.
export async function insertMembership(
  db: Pool,
  email: string,
  status: "pending" | "verified" | "rejected",
) {
  const {
    rows: [company],
  } = await db.query<{ id: string }>(
    `insert into companies (legal_name, siren, naf_code, website)
     values ('Hôtel des Tests', $1, '55.10Z', 'https://www.hotel-des-tests.example')
     returning id`,
    [randomSiren()],
  )
  const { rowCount } = await db.query(
    `insert into company_members (user_id, company_id, job_title, relationship, phone,
       status, reviewed_at, review_note)
     select id, $2, 'Gérant', 'executive', '04 65 71 00 01', $3::membership_status,
       case when $3 = 'pending' then null else now() end,
       case when $3 = 'rejected' then 'Lien non vérifiable.' end
     from "user" where email = $1`,
    [email, company.id, status],
  )
  if (rowCount !== 1) throw new Error(`Compte introuvable : ${email}`)
  return company.id
}

// Compte employeur déjà rattaché à une entreprise vérifiée : il accède à tout son espace.
export async function insertVerifiedMembership(db: Pool, email: string) {
  return insertMembership(db, email, "verified")
}

// Annonce déposée par cet employeur, en attente de vérification de son rattachement (H2).
export async function insertPendingOffer(db: Pool, email: string) {
  const {
    rows: [offer],
  } = await db.query<{ id: string }>(
    `insert into offers (origin, status, company_id, created_by_user_id, title, season,
       commune_name, department_code, duration_value, duration_unit, apply_email)
     select 'deposited', 'pending_review', m.company_id, m.user_id, 'Réceptionniste de nuit',
       'summer', 'Annecy', '74', 3, 'months', 'rh@hotel-e2e.example'
     from company_members m join "user" u on u.id = m.user_id
     where u.email = $1
     returning id`,
    [email],
  )
  if (!offer) throw new Error(`Rattachement introuvable : ${email}`)
  return offer.id
}
