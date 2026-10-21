import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

// Applique les migrations sur la base de test avant les tests d'intégration.
export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith("_test")) {
    throw new Error(
      "Les tests d'intégration exigent une base dont le nom finit par _test (voir .env.test.local).",
    )
  }

  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" })
  } finally {
    await pool.end()
  }
}
