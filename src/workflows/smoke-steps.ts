import { sql } from "drizzle-orm"

import { db } from "@/lib/db"

// Vérifie qu'une étape atteint la base (pg) depuis le déploiement.
export async function smokeDatabaseStep() {
  "use step"
  const result = await db.execute<{ now: Date }>(sql`select now() as now`)
  return new Date(result.rows[0].now).toISOString()
}

export async function smokeFinishStep() {
  "use step"
  return new Date().toISOString()
}
