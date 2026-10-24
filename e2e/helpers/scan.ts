import { drizzle } from "drizzle-orm/node-postgres"
import type { Pool } from "pg"

import { scanLimits } from "../../src/domain/scan/limits"
import {
  scanCandidates,
  scanRuns,
  scanSources,
} from "../../src/lib/db/schema/scan"

// Pas de TRUNCATE CASCADE : les annonces publiées par les tests restent en place.
export async function resetScan(db: Pool) {
  const client = await db.connect()
  try {
    await client.query("begin")
    await client.query(
      "update scan_candidates set occupation_review_id = null where occupation_review_id is not null",
    )
    await client.query("delete from scan_reviews")
    await client.query("delete from scan_run_sources")
    await client.query("delete from scan_candidates")
    await client.query("delete from scan_runs")
    await client.query("delete from scan_sources")
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function insertScanRun(
  db: Pool,
  values: Partial<typeof scanRuns.$inferInsert> = {},
) {
  const now = values.startedAt ?? new Date()
  const daily = values.mode === "daily"
  const [run] = await drizzle({ client: db, casing: "snake_case" })
    .insert(scanRuns)
    .values({
      mode: daily ? "daily" : "bootstrap",
      runKey: daily ? `daily:${now.toISOString().slice(0, 10)}` : "bootstrap",
      trigger: "admin",
      startedAt: now,
      ...(daily
        ? { windowStart: new Date(+now - scanLimits.dailyWindowMs) }
        : {
            deadlineAt: new Date(+now + scanLimits.bootstrapDeadlineMs),
            targetCount: scanLimits.bootstrapTarget,
          }),
      ...values,
    })
    .returning()
  return run
}

export async function insertScanCandidate(
  db: Pool,
  values: Partial<typeof scanCandidates.$inferInsert> = {},
) {
  const runId = values.firstRunId ?? (await insertScanRun(db)).id
  const identity = crypto.randomUUID()
  const delivered = ["to_review", "published", "rejected"].includes(
    values.status ?? "discovered",
  )
  const [candidate] = await drizzle({ client: db, casing: "snake_case" })
    .insert(scanCandidates)
    .values({
      sourceKey: "fixture",
      identityKey: identity,
      listingHash: identity,
      discoveryUrl: `https://hotel.example/offres/${identity}`,
      firstRunId: runId,
      ...(delivered
        ? {
            title: "Serveur / serveuse fictif",
            readyForReviewAt: new Date(),
            deliveredRunId: runId,
          }
        : {}),
      ...values,
    })
    .returning()
  return candidate
}

export async function enableScanSource(
  db: Pool,
  key: string,
  { autoPublish = false }: { autoPublish?: boolean } = {},
) {
  await drizzle({ client: db, casing: "snake_case" })
    .insert(scanSources)
    .values({ key, enabled: true, autoPublish })
    .onConflictDoUpdate({
      target: scanSources.key,
      set: { enabled: true, autoPublish },
    })
}
