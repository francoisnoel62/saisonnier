import "server-only"

import { and, eq, sql } from "drizzle-orm"
import type { PgUpdateSetSource } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import { scanRunSources, type ScanRunSource } from "@/lib/db/schema"

import { withRunClaim } from "./claim"

export function initRunSources(
  runId: string,
  keys: readonly string[],
  token: string,
) {
  return withRunClaim(runId, token, async (tx) => {
    if (keys.length)
      await tx
        .insert(scanRunSources)
        .values([...new Set(keys)].map((sourceKey) => ({ runId, sourceKey })))
        .onConflictDoNothing()
    return { ok: true } as const
  })
}

const counterKeys = [
  "listedCount",
  "fetchedCount",
  "deliveredCount",
  "excludedCount",
  "failedCount",
  "requestCount",
  "bytesDownloaded",
] as const
type CounterKey = (typeof counterKeys)[number]
export type RunSourcePatch = Partial<
  Pick<
    ScanRunSource,
    | "status"
    | "cursor"
    | "lastRequestAt"
    | "lastError"
    | "startedAt"
    | "finishedAt"
  >
> &
  Partial<Record<CounterKey, number>>

export function updateRunSource(
  runId: string,
  key: string,
  token: string,
  patch: RunSourcePatch,
) {
  for (const counter of counterKeys) {
    const delta = patch[counter]
    if (delta !== undefined && (!Number.isSafeInteger(delta) || delta < 0))
      throw new RangeError(
        "Un compteur du scan s'incrémente d'un entier positif ou nul",
      )
  }
  return withRunClaim(runId, token, async (tx) => {
    const updates: PgUpdateSetSource<typeof scanRunSources> = { ...patch }
    for (const counter of counterKeys) {
      if (patch[counter] !== undefined)
        updates[counter] = sql`${scanRunSources[counter]} + ${patch[counter]}`
    }
    if (!Object.keys(updates).length) return { ok: true } as const
    const [source] = await tx
      .update(scanRunSources)
      .set(updates)
      .where(
        and(eq(scanRunSources.runId, runId), eq(scanRunSources.sourceKey, key)),
      )
      .returning()
    return source
      ? ({ ok: true, source } as const)
      : ({ ok: false, reason: "source_not_initialized" } as const)
  })
}

// Calcule un délai à transmettre au Workflow ; aucun sommeil dans une transaction.
export async function waitBeforeNextRequest(
  runId: string,
  key: string,
  interval: number,
  now = new Date(),
) {
  if (!Number.isFinite(interval) || interval < 0)
    throw new RangeError("Intervalle invalide")
  const [source] = await db
    .select({ lastRequestAt: scanRunSources.lastRequestAt })
    .from(scanRunSources)
    .where(
      and(eq(scanRunSources.runId, runId), eq(scanRunSources.sourceKey, key)),
    )
  return source?.lastRequestAt
    ? Math.max(0, source.lastRequestAt.getTime() + interval - now.getTime())
    : 0
}
