import "server-only"

import { and, count, eq, ne, sql } from "drizzle-orm"

import {
  parseEventDetails,
  type ScanSourceEventInput,
} from "@/domain/scan/source-events"
import {
  switchBlockerMessage,
  switchBlockers,
} from "@/domain/scan/source-lifecycle"
import {
  scanSourceSwitches,
  type ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import { scanSourceEvents, scanSources } from "@/lib/db/schema"

import type { ScanTransaction } from "../claim"
import { isScanSourceKey, isSourceAdapterAvailable } from "./registry"

// Écritures du registre : transaction, ligne verrouillée (`for update`), version optimiste et
// un événement du journal par écriture. Un refus métier renvoie un message, jamais une erreur SQL.
export type SourceWriteResult =
  | { ok: true; version: number }
  | {
      ok: false
      reason: "unknown" | "conflict" | "blocked" | "invalid"
      message: string
    }
export const unknownSource = {
  ok: false,
  reason: "unknown",
  message: "Source inconnue.",
} as const
export const sourceConflict = {
  ok: false,
  reason: "conflict",
  message:
    "La source a été modifiée entre-temps. Rechargez : votre saisie est conservée.",
} as const

export async function recordSourceEvent(
  tx: ScanTransaction,
  sourceKey: string,
  event: ScanSourceEventInput,
  { actorUserId, revision }: { actorUserId: string | null; revision?: number },
) {
  const details = parseEventDetails(event)
  await tx.insert(scanSourceEvents).values({
    sourceKey,
    kind: event.kind,
    revision,
    details,
    actorUserId,
  })
  // Journal serveur sans contenu de page.
  console.info(`[scan source] ${event.kind}`, { sourceKey, revision })
}

export async function lockScanSource(tx: ScanTransaction, key: string) {
  const [row] = await tx
    .select()
    .from(scanSources)
    .where(eq(scanSources.key, key))
    .for("update")
  return row ?? null
}

// Interrupteurs indépendants (D11), soumis à leurs portes (§10.2) même hors de l'écran.
export function setSourceSwitch(
  key: string,
  flag: ScanSourceSwitch,
  value: boolean,
  adminId: string,
  { version }: { version?: number } = {},
): Promise<SourceWriteResult> {
  if (
    !isScanSourceKey(key) ||
    !scanSourceSwitches.includes(flag) ||
    typeof value !== "boolean"
  )
    return Promise.resolve({
      ok: false,
      reason: "invalid",
      message: "Source ou état invalide.",
    })
  return db.transaction(async (tx) => {
    // Le plafond des sources activées vaut aussi pour deux activations concurrentes.
    if (flag === "enabled" && value)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('scan_sources_enabled'))`,
      )
    const source = await lockScanSource(tx, key)
    if (!source) return unknownSource
    if (version !== undefined && source.version !== version)
      return sourceConflict
    if (source[flag] === value) return { ok: true, version: source.version }
    const [{ enabledCount }] = await tx
      .select({ enabledCount: count() })
      .from(scanSources)
      .where(and(eq(scanSources.enabled, true), ne(scanSources.key, key)))
    const blockers = switchBlockers(source, flag, value, {
      adapterAvailable: isSourceAdapterAvailable(source),
      enabledCount,
    })
    if (blockers.length)
      return {
        ok: false,
        reason: "blocked",
        message: blockers
          .map((blocker) => switchBlockerMessage(blocker, source))
          .join(" "),
      }
    const next = source.version + 1
    await tx
      .update(scanSources)
      .set({ [flag]: value, updatedByUserId: adminId, version: next })
      .where(eq(scanSources.key, key))
    await recordSourceEvent(
      tx,
      key,
      { kind: "switched", details: { flag, value } },
      { actorUserId: adminId, revision: source.revision },
    )
    return { ok: true, version: next }
  })
}
