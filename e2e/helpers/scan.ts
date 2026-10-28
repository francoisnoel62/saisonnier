import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import type { Pool } from "pg"

import { scanLimits } from "../../src/domain/scan/limits"
import type { ScanSourceDraftSnapshot } from "../../src/domain/scan/source"
import {
  scanCandidates,
  scanRuns,
  scanSourceRevisions,
  scanSources,
} from "../../src/lib/db/schema/scan"
import { sourceConfigHash } from "../../src/server/scan/sources/config-hash"
import {
  fixtureSourceKey,
  fixtureSourceState,
  replaySourceSeed,
} from "../../src/test/scan-sources"

// Pas de TRUNCATE CASCADE : les annonces publiées par les tests restent en place. Les sources
// reviennent à l'état de la migration 0018 ; `fixture` garde sa configuration et revient à son
// état initial (prête, désactivée).
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
    await client.query("delete from scan_source_events")
    await client.query("delete from scan_source_hosts")
    await client.query("delete from scan_sources where key <> $1", [
      fixtureSourceKey,
    ])
    await replaySourceSeed(client)
    await drizzle({ client, casing: "snake_case" })
      .update(scanSources)
      .set(fixtureSourceState)
      .where(eq(scanSources.key, fixtureSourceKey))
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

// Raccourci de test : qualifie la source si besoin (prête, reprise acceptée et datée), puis pose
// les interrupteurs. La publication automatique implique les passages quotidiens ; elle est
// refusée à une découverte, comme en base.
export async function enableScanSource(
  db: Pool,
  key: string,
  {
    autoPublish = false,
    daily = autoPublish,
  }: { autoPublish?: boolean; daily?: boolean } = {},
) {
  const orm = drizzle({ client: db, casing: "snake_case" })
  const [source] = await orm
    .select()
    .from(scanSources)
    .where(eq(scanSources.key, key))
  if (!source) throw new Error(`Source inconnue : ${key}`)
  if (autoPublish && source.kind === "discovery")
    throw new Error("Une découverte ne publie jamais automatiquement")
  await orm
    .update(scanSources)
    .set({
      status: "ready",
      rejectionReason: null,
      archivedAt: null,
      ...(source.reuseDecision === "authorized" ||
      source.reuseDecision === "accepted"
        ? {}
        : {
            reuseDecision: "accepted" as const,
            reuseDecisionNote: "Acceptée pour un test.",
            reuseDecidedAt: new Date(),
          }),
      ...(daily && source.kind === "discovery" && !source.scheduledAccessBasis
        ? { scheduledAccessBasis: "Justification de test." }
        : {}),
      enabled: true,
      dailyEnabled: daily,
      autoPublish,
    })
    .where(eq(scanSources.key, key))
}

// Source inventée par un test (clé absente du registre migré), en brouillon, version 1.
export async function insertScanSource(
  db: Pool,
  overrides: Partial<typeof scanSources.$inferInsert> & { key: string },
) {
  const orm = drizzle({ client: db, casing: "snake_case" })
  const definition: ScanSourceDraftSnapshot = {
    label: overrides.label ?? overrides.key,
    kind: "employer",
  }
  const [source] = await orm
    .insert(scanSources)
    .values({
      label: definition.label,
      kind: "employer",
      revision: 1,
      ...overrides,
    })
    .returning()
  await orm.insert(scanSourceRevisions).values({
    sourceKey: source.key,
    revision: 1,
    definition,
    complete: false,
    configHash: sourceConfigHash(definition),
  })
  return source
}
