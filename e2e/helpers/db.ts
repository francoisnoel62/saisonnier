import { Pool } from "pg"

// Référentiels insérés par migration : conservés entre deux exécutions.
// Tout nouveau référentiel s'ajoute ici, sinon il est vidé avec les données de test.
export const REFERENCE_TABLES = [
  "regions",
  "departments",
  "occupations",
  "blocked_domains",
]

// Garde-fou : l'E2E vide des tables, il ne doit jamais viser la base de développement.
export function testDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith("_test")) {
    throw new Error(
      "L'E2E exige une base dont le nom finit par _test (voir .env.test.local).",
    )
  }
  return url
}

export function createDb() {
  return new Pool({ connectionString: testDatabaseUrl() })
}

// Vide toutes les tables de l'application, sauf les référentiels.
export async function truncateData(db: Pool) {
  const { rows } = await db.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  )
  const tables = rows
    .map((row) => row.tablename)
    .filter((name) => !REFERENCE_TABLES.includes(name))
  if (tables.length === 0) return
  await db.query(
    `truncate ${tables.map((name) => `"${name}"`).join(", ")} restart identity cascade`,
  )
}

// L'inscription envoie un lien de vérification que l'E2E n'ouvre pas : on confirme l'email en SQL,
// et on pose le rôle (le client ne peut pas le choisir).
export async function verifyAccount(
  db: Pool,
  email: string,
  role: "candidate" | "employer" | "admin",
) {
  const { rowCount } = await db.query(
    `update "user" set email_verified = true, role = $2 where email = $1`,
    [email, role],
  )
  if (rowCount !== 1) throw new Error(`Compte introuvable : ${email}`)
}
