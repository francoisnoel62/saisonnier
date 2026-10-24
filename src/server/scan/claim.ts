import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { activeRunStatuses } from "@/domain/scan/run"
import { db } from "@/lib/db"
import { scanRuns, type ScanRun } from "@/lib/db/schema"

export type ScanTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]
export const superseded = { ok: false, reason: "superseded" } as const

// Toutes les écritures d'un workflow verrouillent le passage avant toute autre ligne.
// La reprise attend donc la fin d'une écriture et invalide atomiquement l'ancien jeton.
export function withRunClaim<T>(
  runId: string,
  token: string,
  write: (tx: ScanTransaction, run: ScanRun) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(scanRuns)
      .where(
        and(
          eq(scanRuns.id, runId),
          eq(scanRuns.claimToken, token),
          inArray(scanRuns.status, activeRunStatuses),
        ),
      )
      .for("update")
    return run ? write(tx, run) : superseded
  })
}
