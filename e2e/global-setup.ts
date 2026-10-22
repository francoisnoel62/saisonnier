import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createDb, truncateData } from "./helpers/db"
import { clearOutbox } from "./helpers/outbox"

// Base de test à l'état neuf avant chaque exécution : migrations appliquées, données vidées,
// boîte d'emails vide.
export default async function globalSetup() {
  await clearOutbox()
  const db = createDb()
  try {
    await migrate(drizzle({ client: db }), { migrationsFolder: "drizzle" })
    await truncateData(db)
  } finally {
    await db.end()
  }
}
