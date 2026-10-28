import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { seedScanSources } from "../src/test/scan-sources"
import { createDb, truncateData } from "./helpers/db"
import { SCAN_FIXTURE_PORT } from "./helpers/env"
import { clearOutbox } from "./helpers/outbox"

// Base de test à l'état neuf avant chaque exécution : migrations appliquées, données vidées,
// sources réensemencées (elles ne sont pas des référentiels : `truncateData` les vide avec
// `user` et `companies`), boîte d'emails vide.
export default async function globalSetup() {
  await clearOutbox()
  const db = createDb()
  try {
    await migrate(drizzle({ client: db }), { migrationsFolder: "drizzle" })
    await truncateData(db)
    await seedScanSources(db, {
      testSourceUrl: `http://localhost:${SCAN_FIXTURE_PORT}`,
    })
  } finally {
    await db.end()
  }
}
