import "server-only"

import {
  and,
  asc,
  count,
  eq,
  inArray,
  max,
  ne,
  notInArray,
  sql,
} from "drizzle-orm"
import { z } from "zod"

import { isBlockedHost } from "@/domain/blocked-domains"
import { todayInParis } from "@/domain/offer-activity"
import { scanLimits } from "@/domain/scan/limits"
import {
  isCompleteSnapshot,
  type ScanSourceDraftSnapshot,
} from "@/domain/scan/source"
import {
  parseEventDetails,
  type ScanSourceEventInput,
} from "@/domain/scan/source-events"
import {
  identityFields,
  revisionDiff,
  scanSourceFormSchema,
  type SourceFormValues,
} from "@/domain/scan/source-form"
import { sourceKeyFromLabel } from "@/domain/scan/source-key"
import {
  moveInOrder,
  sourceTransitionMoves,
  switchBlockerMessage,
  switchBlockers,
  transitionBlockerMessage,
  transitionBlockers,
  type SourceTransition,
} from "@/domain/scan/source-lifecycle"
import { qualificationGaps } from "@/domain/scan/source-qualification"
import {
  scanReuseDecisions,
  scanSourceSwitches,
  type ScanReuseDecision,
  type ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  blockedDomains,
  companies,
  scanCandidates,
  scanReviews,
  scanRunSources,
  scanSourceEvents,
  scanSourceHosts,
  scanSourceRevisions,
  scanSources,
  type ScanSourceRow,
} from "@/lib/db/schema"
import { env } from "@/lib/env"
import { getBlockedDomains } from "@/server/offers/application"

import type { ScanTransaction } from "../claim"
import { rejectCandidate } from "../review"
import { sourceConfigHash } from "./config-hash"
import { sourceQualification } from "./qualification"
import { isScanSourceKey, isSourceAdapterAvailable } from "./registry"

// Écritures du registre : transaction, ligne verrouillée (`for update`), version optimiste et
// un événement du journal par écriture. Un refus métier renvoie un message, jamais une erreur SQL.
export type SourceWriteRefusal = {
  ok: false
  reason:
    | "unknown"
    | "conflict"
    | "blocked"
    | "invalid"
    | "needs_test"
    | "host_taken"
    | "in_use"
    | "incomplete"
  message: string
  fieldErrors?: Record<string, string[]>
}
export type SourceWriteResult =
  | { ok: true; version: number; key: string; revision?: number }
  | SourceWriteRefusal
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
const invalidRequest = {
  ok: false,
  reason: "invalid",
  message: "Demande invalide.",
} as const

export async function recordSourceEvent(
  tx: ScanTransaction,
  sourceKey: string,
  event: ScanSourceEventInput,
  {
    actorUserId,
    revision,
    createdAt,
  }: { actorUserId: string | null; revision?: number; createdAt?: Date },
) {
  const details = parseEventDetails(event)
  const [inserted] = await tx
    .insert(scanSourceEvents)
    .values({
      sourceKey,
      kind: event.kind,
      revision,
      details,
      actorUserId,
      ...(createdAt ? { createdAt } : {}),
    })
    .returning({ id: scanSourceEvents.id })
  // Journal serveur sans contenu de page.
  console.info(`[scan source] ${event.kind}`, { sourceKey, revision })
  return inserted.id
}

export async function lockScanSource(tx: ScanTransaction, key: string) {
  const [row] = await tx
    .select()
    .from(scanSources)
    .where(eq(scanSources.key, key))
    .for("update")
  return row ?? null
}

function fieldErrorsOf(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".")
    ;(fieldErrors[path] ??= []).push(issue.message)
  }
  return fieldErrors
}
function parseForm(values: SourceFormValues) {
  return scanSourceFormSchema({
    today: todayInParis(new Date()),
    testSourceUrl: env.SCAN_TEST_SOURCE_URL,
  }).safeParse(values)
}

// D7 : un hôte officiel appartient à une seule source non archivée. L'origine locale de test
// n'est jamais réservée (plusieurs sources de test la partagent).
class HostTakenError extends Error {
  constructor(
    readonly host: string,
    readonly ownerLabel: string,
  ) {
    super(`${host} appartient déjà à la source « ${ownerLabel} ».`)
  }
}
function reservedHosts(snapshot: ScanSourceDraftSnapshot) {
  const testHost = env.SCAN_TEST_SOURCE_URL
    ? new URL(env.SCAN_TEST_SOURCE_URL).hostname
    : null
  return [...new Set(snapshot.officialHosts ?? [])].filter(
    (host) => snapshot.adapter !== "fixture" && host !== testHost,
  )
}
async function syncHosts(
  tx: ScanTransaction,
  key: string,
  snapshot: ScanSourceDraftSnapshot,
) {
  const hosts = reservedHosts(snapshot)
  const owners = async () =>
    hosts.length
      ? tx
          .select({
            host: scanSourceHosts.host,
            sourceKey: scanSourceHosts.sourceKey,
            label: scanSources.label,
          })
          .from(scanSourceHosts)
          .innerJoin(
            scanSources,
            eq(scanSources.key, scanSourceHosts.sourceKey),
          )
          .where(inArray(scanSourceHosts.host, hosts))
      : []
  const check = async () => {
    const taken = (await owners()).find((owner) => owner.sourceKey !== key)
    if (taken) throw new HostTakenError(taken.host, taken.label)
  }
  await check()
  await tx
    .delete(scanSourceHosts)
    .where(
      hosts.length
        ? and(
            eq(scanSourceHosts.sourceKey, key),
            notInArray(scanSourceHosts.host, hosts),
          )
        : eq(scanSourceHosts.sourceKey, key),
    )
  if (hosts.length)
    await tx
      .insert(scanSourceHosts)
      .values(hosts.map((host) => ({ host, sourceKey: key })))
      .onConflictDoNothing()
  // Deux réservations concurrentes : la seconde voit la première une fois celle-ci validée.
  await check()
}
// Rejoue l'écriture en refus motivé si un hôte est pris (la transaction est annulée).
async function withHostCheck(
  write: () => Promise<SourceWriteResult>,
): Promise<SourceWriteResult> {
  try {
    return await write()
  } catch (error) {
    if (error instanceof HostTakenError)
      return { ok: false, reason: "host_taken", message: error.message }
    throw error
  }
}

// D6 : un portail employeur n'est jamais hébergé sur un domaine exclu.
function employerBlockedHosts(
  snapshot: ScanSourceDraftSnapshot,
  blockedDomains: readonly string[],
) {
  if (snapshot.kind !== "employer") return []
  const hosts = [
    ...(snapshot.officialHosts ?? []),
    ...[...(snapshot.listUrls ?? []), snapshot.employerWebsite]
      .filter((url): url is string => !!url)
      .map((url) => {
        try {
          return new URL(url).hostname
        } catch {
          return null
        }
      }),
  ].filter((host): host is string => !!host)
  return [...new Set(hosts)].filter((host) =>
    isBlockedHost(host, blockedDomains),
  )
}
function blockedHostsRefusal(hosts: string[]): SourceWriteRefusal {
  return {
    ok: false,
    reason: "blocked",
    message: `${hosts.join(", ")} relève d'un domaine exclu : un portail employeur ne peut pas y être hébergé. Enregistrez-le comme découverte, ou écartez-le.`,
  }
}

// Colonnes de la ligne qui reflètent la version courante.
async function identityColumns(
  tx: ScanTransaction,
  snapshot: ScanSourceDraftSnapshot,
  current?: ScanSourceRow,
) {
  const siren = snapshot.kind === "employer" ? snapshot.employer?.siren : null
  let companyId = current?.companyId ?? null
  if ((current?.employerSiren ?? null) !== (siren ?? null)) {
    const [company] = siren
      ? await tx
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.siren, siren))
      : []
    companyId = company?.id ?? null
  }
  return {
    label: snapshot.label,
    kind: snapshot.kind,
    adapter: snapshot.adapter ?? null,
    employerName:
      snapshot.kind === "employer" ? (snapshot.employer?.name ?? null) : null,
    employerSiren: siren ?? null,
    employerWebsite:
      snapshot.kind === "employer" ? (snapshot.employerWebsite ?? null) : null,
    companyId: snapshot.kind === "employer" ? companyId : null,
  }
}

export function createSource(
  values: SourceFormValues,
  adminId: string,
): Promise<SourceWriteResult> {
  const parsed = parseForm(values)
  if (!parsed.success)
    return Promise.resolve({
      ok: false,
      reason: "invalid",
      message: "Corrigez les champs signalés.",
      fieldErrors: fieldErrorsOf(parsed.error),
    })
  const { snapshot, note } = parsed.data
  return withHostCheck(() =>
    db.transaction(async (tx) => {
      const blocked = employerBlockedHosts(
        snapshot,
        await getBlockedDomains(tx),
      )
      if (blocked.length) return blockedHostsRefusal(blocked)
      // Clés attribuées une à une : une clé, même archivée, n'est jamais réattribuée.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('scan_sources_keys'))`,
      )
      const taken = await tx.select({ key: scanSources.key }).from(scanSources)
      const key = sourceKeyFromLabel(
        snapshot.label,
        taken.map((row) => row.key),
      )
      const [{ last }] = await tx
        .select({ last: max(scanSources.priority) })
        .from(scanSources)
      await tx.insert(scanSources).values({
        key,
        ...(await identityColumns(tx, snapshot)),
        status: "draft",
        revision: 1,
        role: "reserve",
        priority: (last ?? 0) + 10,
        createdByUserId: adminId,
        updatedByUserId: adminId,
      })
      await tx.insert(scanSourceRevisions).values({
        sourceKey: key,
        revision: 1,
        definition: snapshot,
        complete: isCompleteSnapshot(snapshot),
        configHash: sourceConfigHash(snapshot),
        note,
        createdByUserId: adminId,
      })
      await syncHosts(tx, key, snapshot)
      await recordSourceEvent(
        tx,
        key,
        {
          kind: "created",
          details: {
            revision: 1,
            ...(snapshot.listUrls?.[0]
              ? { startUrl: snapshot.listUrls[0] }
              : {}),
          },
        },
        { actorUserId: adminId, revision: 1 },
      )
      return { ok: true, version: 1, key, revision: 1 }
    }),
  )
}

// D4 : test réussi de la même empreinte, de moins d'une heure.
async function recentSample(
  tx: ScanTransaction,
  key: string,
  testId: string | undefined,
  configHash: string,
  now: Date,
) {
  if (!testId || !z.uuid().safeParse(testId).success) return false
  const [event] = await tx
    .select()
    .from(scanSourceEvents)
    .where(
      and(
        eq(scanSourceEvents.id, testId),
        eq(scanSourceEvents.sourceKey, key),
        eq(scanSourceEvents.kind, "sampled"),
      ),
    )
  const details = event?.details as
    { configHash?: string; status?: string; ok?: boolean } | undefined
  return (
    !!event &&
    details?.configHash === configHash &&
    details.status === "done" &&
    details.ok === true &&
    now.getTime() - event.createdAt.getTime() <=
      scanLimits.sourceEditTestMaxAgeMs
  )
}

// Nouvelle version si l'instantané change. Sur une source prête : configuration complète,
// échantillon réussi de la nouvelle empreinte si elle change ce qui est lu, motif si l'identité
// change.
function reviseSnapshot(
  key: string,
  version: number,
  snapshot: ScanSourceDraftSnapshot,
  adminId: string,
  {
    note,
    testId,
    restoredFrom,
    now = new Date(),
  }: {
    note: string | null
    testId?: string
    restoredFrom?: number
    now?: Date
  },
): Promise<SourceWriteResult> {
  return withHostCheck(() =>
    db.transaction(async (tx) => {
      const row = await lockScanSource(tx, key)
      if (!row) return unknownSource
      if (row.version !== version) return sourceConflict
      if (row.status === "archived")
        return {
          ok: false,
          reason: "blocked",
          message: "Source archivée : restaurez-la avant de la modifier.",
        }
      const [current] = await tx
        .select()
        .from(scanSourceRevisions)
        .where(
          and(
            eq(scanSourceRevisions.sourceKey, key),
            eq(scanSourceRevisions.revision, row.revision),
          ),
        )
      const before = current.definition as ScanSourceDraftSnapshot
      const changes = revisionDiff(before, snapshot)
      if (!changes.length) return { ok: true, version: row.version, key }
      const changedFields = changes.map((change) => change.field)
      if (changedFields.includes("kind")) {
        const [{ runs }] = await tx
          .select({ runs: count() })
          .from(scanRunSources)
          .where(eq(scanRunSources.sourceKey, key))
        if (runs > 0)
          return {
            ok: false,
            reason: "blocked",
            message:
              "Le type ne change plus une fois la source lue par un passage.",
          }
      }
      const configHash = sourceConfigHash(snapshot)
      const complete = isCompleteSnapshot(snapshot)
      if (row.status === "ready") {
        if (!complete)
          return {
            ok: false,
            reason: "incomplete",
            message:
              "Configuration incomplète : une source prête ne la reçoit pas. Repassez-la en brouillon pour l'enregistrer.",
          }
        if (
          configHash !== current.configHash &&
          !(await recentSample(tx, key, testId, configHash, now))
        )
          return {
            ok: false,
            reason: "needs_test",
            message:
              "Testez ces réglages avant de les enregistrer sur une source prête.",
          }
        if (
          !note &&
          changedFields.some((field) => identityFields.includes(field))
        )
          return {
            ok: false,
            reason: "invalid",
            message: "Indiquez le motif de la modification.",
            fieldErrors: {
              note: ["Motif exigé pour l'identité d'une source prête."],
            },
          }
      }
      const blocked = employerBlockedHosts(
        snapshot,
        await getBlockedDomains(tx),
      )
      if (blocked.length) return blockedHostsRefusal(blocked)
      const [{ last }] = await tx
        .select({ last: max(scanSourceRevisions.revision) })
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, key))
      const revision = (last ?? 0) + 1
      await tx.insert(scanSourceRevisions).values({
        sourceKey: key,
        revision,
        definition: snapshot,
        complete,
        configHash,
        changedFields,
        note,
        createdByUserId: adminId,
        createdAt: now,
      })
      await syncHosts(tx, key, snapshot)
      const next = row.version + 1
      await tx
        .update(scanSources)
        .set({
          ...(await identityColumns(tx, snapshot, row)),
          revision,
          version: next,
          updatedByUserId: adminId,
        })
        .where(eq(scanSources.key, key))
      await recordSourceEvent(
        tx,
        key,
        {
          kind: "revised",
          details: {
            revision,
            changedFields,
            ...(note ? { note } : {}),
            ...(testId ? { testId } : {}),
            ...(restoredFrom ? { restoredFrom } : {}),
          },
        },
        { actorUserId: adminId, revision },
      )
      return { ok: true, version: next, key, revision }
    }),
  )
}

export function reviseSource(
  key: string,
  version: number,
  values: SourceFormValues,
  adminId: string,
  { testId, now }: { testId?: string; now?: Date } = {},
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return Promise.resolve(unknownSource)
  const parsed = parseForm(values)
  if (!parsed.success)
    return Promise.resolve({
      ok: false,
      reason: "invalid",
      message: "Corrigez les champs signalés.",
      fieldErrors: fieldErrorsOf(parsed.error),
    })
  return reviseSnapshot(key, version, parsed.data.snapshot, adminId, {
    note: parsed.data.note,
    testId,
    now,
  })
}

// « Revenir à cette version » : crée la version N+1, copie de l'ancienne (test exigé si elle
// change ce qui est lu sur une source prête).
export async function restoreRevision(
  key: string,
  version: number,
  revision: number,
  adminId: string,
  { testId, now }: { testId?: string; now?: Date } = {},
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  const [target] = await db
    .select()
    .from(scanSourceRevisions)
    .where(
      and(
        eq(scanSourceRevisions.sourceKey, key),
        eq(scanSourceRevisions.revision, revision),
      ),
    )
  if (!target) return invalidRequest
  return reviseSnapshot(
    key,
    version,
    target.definition as ScanSourceDraftSnapshot,
    adminId,
    {
      note: `Retour à la version ${revision}.`,
      testId,
      restoredFrom: revision,
      now,
    },
  )
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
    if (source[flag] === value)
      return { ok: true, version: source.version, key }
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
    return { ok: true, version: next, key }
  })
}

const switchesOff = {
  enabled: false,
  dailyEnabled: false,
  autoPublish: false,
} as const

// Transitions du cycle de vie (§10.1). Archiver libère les hôtes ; restaurer les réserve de
// nouveau, sauf si une autre source les a repris.
export async function transitionSource(
  key: string,
  version: number,
  transition: SourceTransition,
  adminId: string,
  {
    reason,
    rejectPending = false,
    now = new Date(),
  }: { reason?: string; rejectPending?: boolean; now?: Date } = {},
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key) || !(transition in sourceTransitionMoves))
    return invalidRequest
  const result = await withHostCheck(() =>
    db.transaction(async (tx) => {
      const row = await lockScanSource(tx, key)
      if (!row) return unknownSource
      if (row.version !== version) return sourceConflict
      const blockers = transitionBlockers(row.status, transition, { reason })
      if (blockers.length)
        return {
          ok: false,
          reason: "blocked",
          message: blockers
            .map((blocker) =>
              transitionBlockerMessage(blocker, transition, row.status),
            )
            .join(" "),
        }
      const [current] = await tx
        .select()
        .from(scanSourceRevisions)
        .where(
          and(
            eq(scanSourceRevisions.sourceKey, key),
            eq(scanSourceRevisions.revision, row.revision),
          ),
        )
      if (transition === "mark_ready") {
        const gaps = qualificationGaps(
          await sourceQualification(row, current, { tx, now }),
        )
        if (gaps.length)
          return {
            ok: false,
            reason: "blocked",
            message: `À qualifier : ${gaps
              .map((gap) => gap.detail ?? gap.label)
              .join(" ")}`,
          }
      }
      const to = sourceTransitionMoves[transition].to
      if (transition === "archive")
        await tx
          .delete(scanSourceHosts)
          .where(eq(scanSourceHosts.sourceKey, key))
      if (transition === "restore")
        await syncHosts(tx, key, current.definition as ScanSourceDraftSnapshot)
      const next = row.version + 1
      await tx
        .update(scanSources)
        .set({
          status: to,
          ...(to === "ready" ? {} : switchesOff),
          rejectionReason: to === "rejected" ? reason!.trim() : null,
          archivedAt: to === "archived" ? now : null,
          version: next,
          updatedByUserId: adminId,
        })
        .where(eq(scanSources.key, key))
      await recordSourceEvent(
        tx,
        key,
        {
          kind: "status_changed",
          details: {
            from: row.status,
            to,
            ...(reason?.trim() ? { reason: reason.trim() } : {}),
          },
        },
        { actorUserId: adminId, revision: row.revision },
      )
      return { ok: true, version: next, key }
    }),
  )
  // Archiver peut rejeter les dossiers à vérifier : chacun dans sa transaction, après
  // l'archivage, pour ne jamais verrouiller la source avant un dossier.
  if (result.ok && transition === "archive" && rejectPending) {
    const pending = await db
      .select({ id: scanCandidates.id, version: scanCandidates.version })
      .from(scanCandidates)
      .where(
        and(
          eq(scanCandidates.sourceKey, key),
          eq(scanCandidates.status, "to_review"),
        ),
      )
    for (const candidate of pending)
      await rejectCandidate(
        candidate.id,
        candidate.version,
        "source_withdrawn",
        "Source archivée.",
        adminId,
      )
  }
  return result
}

const reuseDecisionSchema = z.object({
  decision: z.enum(scanReuseDecisions),
  note: z
    .string()
    .trim()
    .min(10, "Motif de 10 caractères au moins.")
    .max(2000, "2 000 caractères au plus."),
  scheduledAccessBasis: z
    .string()
    .trim()
    .max(1000, "1 000 caractères au plus.")
    .optional(),
})

// Décision de reprise du fondateur, datée et attribuée. Une décision défavorable repasse une
// source prête en brouillon ; une justification retirée arrête ses passages quotidiens.
export async function decideReuse(
  key: string,
  version: number,
  input: {
    decision: ScanReuseDecision
    note: string
    scheduledAccessBasis?: string
  },
  adminId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  const parsed = reuseDecisionSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      reason: "invalid",
      message: "Corrigez les champs signalés.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  const { decision, note } = parsed.data
  return db.transaction(async (tx) => {
    const row = await lockScanSource(tx, key)
    if (!row) return unknownSource
    if (row.version !== version) return sourceConflict
    const favorable = decision === "authorized" || decision === "accepted"
    const basis =
      row.kind === "discovery" ? parsed.data.scheduledAccessBasis || null : null
    const demote = row.status === "ready" && !favorable
    const next = row.version + 1
    await tx
      .update(scanSources)
      .set({
        reuseDecision: decision,
        reuseDecisionNote: decision === "pending" ? null : note,
        reuseDecidedAt: decision === "pending" ? null : now,
        reuseDecidedByUserId: decision === "pending" ? null : adminId,
        scheduledAccessBasis: basis,
        ...(demote ? { status: "draft" as const, ...switchesOff } : {}),
        ...(!basis && row.kind === "discovery" ? { dailyEnabled: false } : {}),
        version: next,
        updatedByUserId: adminId,
      })
      .where(eq(scanSources.key, key))
    await recordSourceEvent(
      tx,
      key,
      {
        kind: "reuse_decided",
        details: {
          decision,
          note,
          ...(basis ? { scheduledAccessBasis: basis } : {}),
        },
      },
      { actorUserId: adminId, revision: row.revision },
    )
    if (demote)
      await recordSourceEvent(
        tx,
        key,
        {
          kind: "status_changed",
          details: {
            from: "ready",
            to: "draft",
            reason: "Décision de reprise défavorable.",
          },
        },
        { actorUserId: adminId, revision: row.revision },
      )
    else if (!basis && row.kind === "discovery" && row.dailyEnabled)
      await recordSourceEvent(
        tx,
        key,
        {
          kind: "switched",
          details: {
            flag: "dailyEnabled",
            value: false,
            reason: "Justification d'accès programmé retirée.",
          },
        },
        { actorUserId: adminId, revision: row.revision },
      )
    return { ok: true, version: next, key }
  })
}

// D2 : seule une source sans historique se supprime ; sinon elle s'archive.
export async function deleteSource(
  key: string,
  adminId: string,
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  const inUse = {
    ok: false,
    reason: "in_use",
    message: "Cette source a un historique : archivez-la.",
  } as const
  try {
    return await db.transaction(async (tx) => {
      const row = await lockScanSource(tx, key)
      if (!row) return unknownSource
      if (row.enabled || row.dailyEnabled || row.autoPublish)
        return {
          ok: false,
          reason: "blocked",
          message: "Désactivez la source avant de la supprimer.",
        }
      const [cited] = await tx
        .execute<{ cited: boolean }>(
          sql`
        select exists (select 1 from ${scanRunSources} where ${scanRunSources.sourceKey} = ${key})
          or exists (select 1 from ${scanCandidates} where ${scanCandidates.sourceKey} = ${key})
          or exists (select 1 from ${scanReviews} where ${scanReviews.sourceKey} = ${key}) as cited`,
        )
        .then((result) => result.rows)
      if (cited?.cited) return inUse
      await tx.delete(scanSources).where(eq(scanSources.key, key))
      console.info("[scan source] deleted", { sourceKey: key, adminId })
      return { ok: true, version: row.version, key }
    })
  } catch (error) {
    // Clé étrangère restrict : une référence apparue entre-temps.
    if ((error as { cause?: { code?: string } }).cause?.code === "23503")
      return inUse
    throw error
  }
}

// Ordre des sources non archivées : priorité puis libellé ; les priorités sont renumérotées.
export async function moveSource(
  key: string,
  direction: "up" | "down",
  adminId: string,
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('scan_sources_order'))`,
    )
    const rows = await tx
      .select({
        key: scanSources.key,
        priority: scanSources.priority,
        version: scanSources.version,
      })
      .from(scanSources)
      .where(ne(scanSources.status, "archived"))
      .orderBy(asc(scanSources.priority), asc(scanSources.label))
    const index = rows.findIndex((row) => row.key === key)
    if (index < 0) return unknownSource
    const ordered = moveInOrder(rows, index, direction === "up" ? -1 : 1)
    for (const [position, row] of ordered.entries())
      if (row.priority !== position * 10)
        await tx
          .update(scanSources)
          .set({ priority: position * 10, updatedByUserId: adminId })
          .where(eq(scanSources.key, row.key))
    return { ok: true, version: rows[index].version, key }
  })
}

// « Créer la fiche entreprise » (SH15) : la fiche du SIREN de la source, créée avec les données
// de l'annuaire si elle n'existe pas encore, puis liée à la source.
export async function linkSourceCompany(
  key: string,
  adminId: string,
  directory: {
    legalName: string
    displayName: string | null
    nafCode: string | null
    communeName: string | null
  } | null,
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  return db.transaction(async (tx) => {
    const row = await lockScanSource(tx, key)
    if (!row) return unknownSource
    if (row.kind !== "employer" || !row.employerSiren)
      return {
        ok: false,
        reason: "blocked",
        message: "Renseignez d'abord le SIREN de l'employeur.",
      }
    await tx
      .insert(companies)
      .values({
        legalName: directory?.legalName ?? row.employerName ?? row.label,
        displayName: directory?.displayName ?? null,
        siren: row.employerSiren,
        nafCode: directory?.nafCode ?? null,
        communeName: directory?.communeName ?? null,
        website: row.employerWebsite,
      })
      .onConflictDoNothing({ target: companies.siren })
    const [company] = await tx
      .select({ id: companies.id, legalName: companies.legalName })
      .from(companies)
      .where(eq(companies.siren, row.employerSiren))
    const next = row.version + 1
    await tx
      .update(scanSources)
      .set({ companyId: company.id, version: next, updatedByUserId: adminId })
      .where(eq(scanSources.key, key))
    await recordSourceEvent(
      tx,
      key,
      {
        kind: "company_linked",
        details: {
          companyId: company.id,
          legalName: company.legalName,
          siren: row.employerSiren,
        },
      },
      { actorUserId: adminId, revision: row.revision },
    )
    return { ok: true, version: next, key }
  })
}

// D6 : une découverte exige un domaine exclu couvrant ses hôtes ; l'assistant le fait ajouter.
export async function excludeSourceDomain(
  key: string,
  domain: string,
  adminId: string,
): Promise<SourceWriteResult> {
  if (!isScanSourceKey(key)) return unknownSource
  const normalized = String(domain).trim().toLowerCase()
  return db.transaction(async (tx) => {
    const row = await lockScanSource(tx, key)
    if (!row) return unknownSource
    const [current] = await tx
      .select()
      .from(scanSourceRevisions)
      .where(
        and(
          eq(scanSourceRevisions.sourceKey, key),
          eq(scanSourceRevisions.revision, row.revision),
        ),
      )
    const hosts =
      (current.definition as ScanSourceDraftSnapshot).officialHosts ?? []
    if (
      row.kind !== "discovery" ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized) ||
      !hosts.some((host) => isBlockedHost(host, [normalized]))
    )
      return {
        ok: false,
        reason: "invalid",
        message: "Ce domaine ne couvre aucun hôte de cette découverte.",
      }
    await tx
      .insert(blockedDomains)
      .values({
        domain: normalized,
        reason: `Job-board, source de découverte « ${row.label} ».`.slice(
          0,
          200,
        ),
      })
      .onConflictDoNothing()
    await recordSourceEvent(
      tx,
      key,
      { kind: "domain_excluded", details: { domain: normalized } },
      { actorUserId: adminId, revision: row.revision },
    )
    return { ok: true, version: row.version, key }
  })
}
