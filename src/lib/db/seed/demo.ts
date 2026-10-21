// Remplit la base de développement avec le jeu de démonstration (src/lib/db/seed/demo-data.ts),
// daté par rapport à aujourd'hui. Relancer la commande remet le jeu à son état initial :
//   npm run db:seed:demo
// Autre base (preview) : DATABASE_URL=… npm run db:seed:demo. Jamais en production.
// Import par défaut : tsx charge ce script en ESM natif (@next/env est en CommonJS).
import nextEnv from "@next/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { todayInParis } from "@/domain/offer-activity"
import * as schema from "@/lib/db/schema"

import { seedDemo } from "./demo-data"

// Mêmes fichiers .env et mêmes priorités que Next (.env.development.local en local).
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")

const url = process.env.DATABASE_URL
if (process.env.VERCEL_ENV === "production" || !url) {
  console.error(
    url
      ? "Données de démonstration refusées en production (VERCEL_ENV=production)."
      : "DATABASE_URL manquante : voir .env.example.",
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const db = drizzle({ client: pool, schema, casing: "snake_case" })

try {
  const today = todayInParis(new Date())
  const { companies, offers } = await seedDemo(db, today)
  const { host, pathname } = new URL(url)
  console.info(
    `${companies} entreprises et ${offers} offres de démonstration (dates calculées au ${today}) dans la base ${pathname.slice(1)} (${host}).`,
  )
} finally {
  await pool.end()
}
