import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "@/lib/env"

import * as schema from "./schema"

function createPool() {
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  // Fluid compute : ferme proprement les connexions inactives avant la suspension de l'instance.
  attachDatabasePool(pool)
  return pool
}

// En développement, le rechargement à chaud réévalue ce module : on garde un seul pool.
const globalForDb = globalThis as unknown as { dbPool?: Pool }
const pool = globalForDb.dbPool ?? createPool()
if (env.NODE_ENV !== "production") globalForDb.dbPool = pool

export const db = drizzle({ client: pool, schema, casing: "snake_case" })
