import "server-only"

import { and, eq, inArray, sql } from "drizzle-orm"
import type { PgUpdateSetSource } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import {
  scanRunSources,
  scanSources,
  type ScanRunSource,
} from "@/lib/db/schema"

import { withRunClaim } from "./claim"

// SH22 : fige la version courante de chaque source à son entrée dans le passage. À la reprise,
// les lignes existantes gardent leur version ; une source nouvellement activée rejoint le passage.
export function initRunSources(
  runId: string,
  keys: readonly string[],
  token: string,
) {
  return withRunClaim(runId, token, async (tx) => {
    const unique = [...new Set(keys)]
    if (!unique.length) return { ok: true } as const
    const sources = await tx
      .select({ key: scanSources.key, revision: scanSources.revision })
      .from(scanSources)
      .where(inArray(scanSources.key, unique))
    if (sources.length !== unique.length)
      return { ok: false, reason: "unknown_source" } as const
    await tx
      .insert(scanRunSources)
      .values(
        sources.map((source) => ({
          runId,
          sourceKey: source.key,
          sourceRevision: source.revision,
        })),
      )
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
    | "robotsDigest"
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
