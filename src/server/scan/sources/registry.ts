import "server-only"

import { and, asc, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm"

import { isBlockedHost } from "@/domain/blocked-domains"
import {
  adapterDescriptor,
  isAdapterAvailable,
} from "@/domain/scan/adapter-catalog"
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
import {
  qualificationGaps,
  type QualificationItem,
} from "@/domain/scan/source-qualification"
import { scanSourceSwitches, type ScanMode } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanSourceEvents,
  scanSourceRevisions,
  scanSources,
  user,
  type ScanSourceEvent,
  type ScanSourceRevision,
  type ScanSourceRow,
} from "@/lib/db/schema"
import { env } from "@/lib/env"

import type { ScanTransaction } from "../claim"
import { sourceCompany, sourceQualification } from "./qualification"

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
  const rows = await sourceRows(ne(scanSources.status, "archived"))
  const enabledCount = rows.filter(({ row }) => row.enabled).length
  return rows.map(({ row, revision }) =>
    summarize(row, revision, enabledCount, null),
  )
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

// Liste de /admin/scan/sources : toutes les sources, archivées comprises, avec leur dernier
// test, le premier point de qualification manquant et leurs dossiers à vérifier.
export type SourceTestSummary = {
  kind: "probe" | "sample"
  at: string
  // null : test interrompu.
  ok: boolean | null
  // Empreinte de la configuration actuelle.
  current: boolean
}
export type ScanSourceListRow = ScanSourceSummary & {
  adapterVersion: string | null
  lastTest: SourceTestSummary | null
  gap: string | null
  pendingCandidates: number
}
export function testSummary(
  event: Pick<ScanSourceEvent, "kind" | "createdAt" | "details">,
  configHash: string,
): SourceTestSummary {
  const details = event.details as {
    configHash?: string
    status?: string
    ok?: boolean
  }
  return {
    kind: event.kind === "probed" ? "probe" : "sample",
    at: event.createdAt.toISOString(),
    ok:
      details.status === "done"
        ? details.ok === true
        : details.status === "failed"
          ? false
          : null,
    current: details.configHash === configHash,
  }
}

async function sourceRows(where?: SQL) {
  return db
    .select({ row: scanSources, revision: scanSourceRevisions })
    .from(scanSources)
    .innerJoin(
      scanSourceRevisions,
      and(
        eq(scanSourceRevisions.sourceKey, scanSources.key),
        eq(scanSourceRevisions.revision, scanSources.revision),
      ),
    )
    .where(where)
    .orderBy(asc(scanSources.priority), asc(scanSources.label))
}

function summarize(
  row: ScanSourceRow,
  revision: ScanSourceRevision,
  enabledCount: number,
  gap: string | null,
): ScanSourceSummary {
  const definition = revision.definition as ScanSourceDraftSnapshot
  const context = {
    adapterAvailable: isSourceAdapterAvailable(row),
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
        return [
          flag,
          blocker === "not_ready" && row.status === "draft" && gap
            ? gap
            : blocker
              ? switchBlockerMessage(blocker, row)
              : null,
        ]
      }),
    ) as ScanSourceSummary["switchBlockers"],
  }
}

async function lastTests(keys: string[]) {
  if (!keys.length) return new Map<string, ScanSourceEvent>()
  const events = await db
    .selectDistinctOn([scanSourceEvents.sourceKey])
    .from(scanSourceEvents)
    .where(
      and(
        inArray(scanSourceEvents.sourceKey, keys),
        inArray(scanSourceEvents.kind, ["probed", "sampled"]),
      ),
    )
    .orderBy(scanSourceEvents.sourceKey, desc(scanSourceEvents.createdAt))
  return new Map(events.map((event) => [event.sourceKey, event]))
}
async function pendingCandidateCounts() {
  const rows = await db
    .select({ key: scanCandidates.sourceKey, count: count() })
    .from(scanCandidates)
    .where(eq(scanCandidates.status, "to_review"))
    .groupBy(scanCandidates.sourceKey)
  return new Map(rows.map((row) => [row.key, row.count]))
}
// Premier point bloquant de la qualification d'un brouillon, pour la liste et les interrupteurs.
function gapMessage(items: QualificationItem[]) {
  const [gap] = qualificationGaps(items)
  return gap ? `À qualifier : ${gap.detail ?? gap.label}` : null
}

export async function listScanSourceRows(): Promise<ScanSourceListRow[]> {
  const rows = await sourceRows()
  const enabledCount = rows.filter(({ row }) => row.enabled).length
  const [tests, pending] = await Promise.all([
    lastTests(rows.map(({ row }) => row.key)),
    pendingCandidateCounts(),
  ])
  return Promise.all(
    rows.map(async ({ row, revision }) => {
      const gap =
        row.status === "draft"
          ? gapMessage(await sourceQualification(row, revision))
          : null
      const test = tests.get(row.key)
      return {
        ...summarize(row, revision, enabledCount, gap),
        adapterVersion: row.adapter
          ? adapterDescriptor(row.adapter).version
          : null,
        lastTest: test ? testSummary(test, revision.configHash) : null,
        gap,
        pendingCandidates: pending.get(row.key) ?? 0,
      }
    }),
  )
}

// Fiche d'une source : ligne, version courante, historique, journal, qualification, tests.
export async function getScanSourceDetail(key: string) {
  const source = await loadScanSource(key)
  if (!source) return null
  const { row, revision } = source
  const [revisions, events, qualification, company, pending, enabled] =
    await Promise.all([
      db
        .select()
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, key))
        .orderBy(desc(scanSourceRevisions.revision)),
      db
        .select()
        .from(scanSourceEvents)
        .where(eq(scanSourceEvents.sourceKey, key))
        .orderBy(desc(scanSourceEvents.createdAt))
        .limit(200),
      sourceQualification(row, revision),
      row.kind === "employer" ? sourceCompany(row) : null,
      pendingCandidateCounts(),
      db
        .select({ count: count() })
        .from(scanSources)
        .where(eq(scanSources.enabled, true)),
    ])
  const actors = [
    ...new Set(
      [
        ...revisions.map((item) => item.createdByUserId),
        ...events.map((item) => item.actorUserId),
        row.reuseDecidedByUserId,
      ].filter((id): id is string => !!id),
    ),
  ]
  const names = new Map(
    actors.length
      ? (
          await db
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, actors))
        ).map((item) => [item.id, item.name])
      : [],
  )
  const gap = row.status === "draft" ? gapMessage(qualification) : null
  return {
    row,
    revision,
    definition: revision.definition as ScanSourceDraftSnapshot,
    summary: summarize(row, revision, enabled[0].count, gap),
    revisions,
    events,
    qualification,
    company,
    pendingCandidates: pending.get(key) ?? 0,
    actorNames: Object.fromEntries(names) as Record<string, string>,
  }
}
export type ScanSourceDetail = NonNullable<
  Awaited<ReturnType<typeof getScanSourceDetail>>
>

// D6 : sources employeur non archivées couvertes par un domaine nouvellement exclu, à écarter
// ou archiver (signalées par le gestionnaire des domaines exclus, comme les annonces).
export async function employerSourcesOnDomains(domains: readonly string[]) {
  if (!domains.length) return []
  const rows = await sourceRows(
    and(ne(scanSources.status, "archived"), eq(scanSources.kind, "employer")),
  )
  return rows
    .filter(({ revision }) => {
      const definition = revision.definition as ScanSourceDraftSnapshot
      const hosts = [
        ...(definition.officialHosts ?? []),
        ...[...(definition.listUrls ?? []), definition.employerWebsite]
          .filter((url): url is string => !!url && URL.canParse(url))
          .map((url) => new URL(url).hostname),
      ]
      return hosts.some((host) => isBlockedHost(host, domains))
    })
    .map(({ row }) => ({ key: row.key, label: row.label }))
}
