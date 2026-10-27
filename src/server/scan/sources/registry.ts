import "server-only"

import { and, asc, eq, ne } from "drizzle-orm"

import { isAdapterAvailable } from "@/domain/scan/adapter-catalog"
import {
  scanSourceDefinitionErrors,
  scanSourceKeyPattern,
  scanSourceSnapshotSchema,
  type ScanSourceDefinition,
  type ScanSourceDraftSnapshot,
  type ScanSourceSummary,
} from "@/domain/scan/source"
import {
  sourceParticipates,
  switchBlockerMessage,
  switchBlockers,
} from "@/domain/scan/source-lifecycle"
import { scanSourceSwitches, type ScanMode } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  scanSourceRevisions,
  scanSources,
  type ScanSourceRevision,
  type ScanSourceRow,
} from "@/lib/db/schema"
import { env } from "@/lib/env"

import type { ScanTransaction } from "../claim"

// SH20 : lectures du registre des sources ; aucune écriture ici (voir writes.ts).
type Reader = typeof db | ScanTransaction

export const scanUrlPolicy = {
  environment: env.NODE_ENV,
  testSourceUrl: env.SCAN_TEST_SOURCE_URL,
} as const
export function isSourceAdapterAvailable(
  source: Pick<ScanSourceRow, "adapter">,
) {
  return (
    !!source.adapter &&
    isAdapterAvailable(source.adapter, {
      testSourceUrl: env.SCAN_TEST_SOURCE_URL,
    })
  )
}
export function isScanSourceKey(key: unknown): key is string {
  return typeof key === "string" && scanSourceKeyPattern.test(key)
}

// Configuration lue : seule une version complète devient une définition.
export function definitionFrom(
  row: ScanSourceRow,
  revision: ScanSourceRevision,
): ScanSourceDefinition | null {
  if (!revision.complete) return null
  const parsed = scanSourceSnapshotSchema.safeParse(revision.definition)
  return parsed.success
    ? {
        ...parsed.data,
        key: row.key,
        revision: revision.revision,
        role: row.role,
        priority: row.priority,
      }
    : null
}

export async function getScanSource(key: string, tx: Reader = db) {
  if (!isScanSourceKey(key)) return null
  const [row] = await tx
    .select()
    .from(scanSources)
    .where(eq(scanSources.key, key))
  return row ?? null
}

// Ligne et version (courante, ou figée par un passage). `lock` verrouille la ligne : la
// publication la lit `for share` après le dossier.
export async function loadScanSource(
  key: string,
  {
    revision,
    tx = db,
    lock,
  }: { revision?: number; tx?: Reader; lock?: "share" | "update" } = {},
) {
  if (!isScanSourceKey(key)) return null
  const query = tx.select().from(scanSources).where(eq(scanSources.key, key))
  const [row] = await (lock ? query.for(lock) : query)
  if (!row) return null
  const [version] = await tx
    .select()
    .from(scanSourceRevisions)
    .where(
      and(
        eq(scanSourceRevisions.sourceKey, key),
        eq(scanSourceRevisions.revision, revision ?? row.revision),
      ),
    )
  return version ? { row, revision: version } : null
}

export async function getScanSourceDefinition(
  key: string,
  options: { revision?: number; tx?: Reader } = {},
) {
  const source = await loadScanSource(key, options)
  return source ? definitionFrom(source.row, source.revision) : null
}

export async function scanSourceExists(key: string) {
  return (await getScanSource(key)) !== null
}

// Raison pour laquelle sonde et échantillon sont impossibles ; null s'ils le sont.
export function sourceTestRefusal(
  row: ScanSourceRow,
  revision: ScanSourceRevision,
): string | null {
  if (row.status === "rejected") return "Source écartée : aucun test."
  if (row.status === "archived") return "Source archivée : aucun test."
  const definition = definitionFrom(row, revision)
  if (!definition) return "Configuration incomplète."
  if (!isSourceAdapterAvailable(row))
    return "Connecteur indisponible sur ce déploiement."
  const errors = scanSourceDefinitionErrors(definition, scanUrlPolicy)
  return errors.length
    ? `Configuration incomplète : ${errors.join(" ; ")}.`
    : null
}

function checkedAt(definition: ScanSourceDraftSnapshot) {
  return (
    [definition.affiliationProof?.checkedAt, definition.reuse?.checkedAt]
      .filter((date): date is string => !!date)
      .sort()
      .at(-1) ?? null
  )
}

// Ce que l'écran admin montre des sources non archivées, par priorité puis libellé.
export async function listScanSources(): Promise<ScanSourceSummary[]> {
  const rows = await db
    .select({ row: scanSources, revision: scanSourceRevisions })
    .from(scanSources)
    .innerJoin(
      scanSourceRevisions,
      and(
        eq(scanSourceRevisions.sourceKey, scanSources.key),
        eq(scanSourceRevisions.revision, scanSources.revision),
      ),
    )
    .where(ne(scanSources.status, "archived"))
    .orderBy(asc(scanSources.priority), asc(scanSources.label))
  const enabledCount = rows.filter(({ row }) => row.enabled).length
  return rows.map(({ row, revision }) => {
    const definition = revision.definition as ScanSourceDraftSnapshot
    const adapterAvailable = isSourceAdapterAvailable(row)
    const context = {
      adapterAvailable,
      enabledCount: enabledCount - (row.enabled ? 1 : 0),
    }
    return {
      key: row.key,
      label: row.label,
      kind: row.kind,
      role: row.role,
      status: row.status,
      adapter: row.adapter,
      revision: row.revision,
      version: row.version,
      officialHosts: definition.officialHosts ?? [],
      checkedAt: checkedAt(definition),
      complete: revision.complete,
      testable: sourceTestRefusal(row, revision) === null,
      enabled: row.enabled,
      dailyEnabled: row.dailyEnabled,
      autoPublish: row.autoPublish,
      suspended: row.suspendedAt !== null,
      switchBlockers: Object.fromEntries(
        scanSourceSwitches.map((flag) => {
          const [blocker] = switchBlockers(row, flag, true, context)
          return [flag, blocker ? switchBlockerMessage(blocker, row) : null]
        }),
      ) as ScanSourceSummary["switchBlockers"],
    }
  })
}

// Sources lues par un passage de ce mode, avec leur version courante (figée par
// initRunSources), par priorité.
export async function listRunnableSources(mode: ScanMode, tx: Reader = db) {
  const rows = await tx
    .select({ source: scanSources })
    .from(scanSources)
    .innerJoin(
      scanSourceRevisions,
      and(
        eq(scanSourceRevisions.sourceKey, scanSources.key),
        eq(scanSourceRevisions.revision, scanSources.revision),
        eq(scanSourceRevisions.complete, true),
      ),
    )
    .where(and(eq(scanSources.status, "ready"), eq(scanSources.enabled, true)))
    .orderBy(asc(scanSources.priority), asc(scanSources.key))
  return rows
    .map(({ source }) => source)
    .filter((row) =>
      sourceParticipates(row, mode, {
        adapterAvailable: isSourceAdapterAvailable(row),
      }),
    )
    .map((row) => ({ key: row.key, revision: row.revision }))
}
