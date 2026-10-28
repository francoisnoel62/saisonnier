import "server-only"

import { and, desc, eq, inArray, sql } from "drizzle-orm"

import { scanLimits } from "@/domain/scan/limits"
import type { ScanProbeResult } from "@/domain/scan/probe"
import type { ExtractionSample } from "@/domain/scan/sample"
import {
  scanSourceDefinitionErrors,
  scanSourceSnapshotSchema,
  type ScanSourceDefinition,
} from "@/domain/scan/source"
import {
  scanSourceFormSchema,
  type SourceFormValues,
} from "@/domain/scan/source-form"
import { todayInParis } from "@/domain/offer-activity"
import { db } from "@/lib/db"
import { scanSourceEvents } from "@/lib/db/schema"
import { env } from "@/lib/env"

import { probeScanSource } from "../probe"
import { sampleScanSource } from "../sample"
import { sourceConfigHash } from "./config-hash"
import {
  definitionFrom,
  isSourceAdapterAvailable,
  loadScanSource,
  scanUrlPolicy,
  sourceTestRefusal,
} from "./registry"
import { lockScanSource, recordSourceEvent } from "./writes"

// Sonde et échantillon d'une source (D4) : sur sa version courante, ou sur des valeurs saisies
// non enregistrées. Chaque test est conservé avec l'empreinte testée ; 30 s séparent deux tests
// d'une même source ; seuls les 20 derniers tests, sonde, échantillon ou détection, sont gardés.
export type SourceTestKind = "probe" | "sample"
export const testEventKinds = ["probed", "sampled", "detected"] as const
export type SourceTestRefusal = {
  ok: false
  reason: "unknown" | "cooldown" | "incomplete"
  message: string
  fieldErrors?: Record<string, string[]>
}
export type SourceTestOutcome =
  | ({ ok: true; testId: string; configHash: string; succeeded: boolean } & (
      | { kind: "probe"; result: ScanProbeResult }
      | { kind: "sample"; result: ExtractionSample }
    ))
  | SourceTestRefusal

export function deploymentUrl() {
  return env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.BETTER_AUTH_URL
}
export function deploymentEnvironment() {
  return env.VERCEL_ENV ?? "local"
}
export function probeSucceeded(result: ScanProbeResult) {
  return (
    result.requests.length > 0 && result.requests.every((request) => request.ok)
  )
}
export function sampleSucceeded(result: ExtractionSample) {
  return !result.failure
}

export function formFieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[]
}) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".")
    ;(fieldErrors[path] ??= []).push(issue.message)
  }
  return fieldErrors
}

// Définition à tester : la version courante, ou les valeurs saisies validées par le schéma
// strict (l'admin teste avant d'enregistrer).
async function definitionToTest(
  key: string,
  values: SourceFormValues | undefined,
): Promise<
  | { ok: true; definition: ScanSourceDefinition; draft: boolean }
  | SourceTestRefusal
> {
  const source = await loadScanSource(key)
  if (!source)
    return { ok: false, reason: "unknown", message: "Source inconnue." }
  if (!values) {
    const refusal = sourceTestRefusal(source.row, source.revision)
    const definition = definitionFrom(source.row, source.revision)
    return refusal || !definition
      ? {
          ok: false,
          reason: "incomplete",
          message: refusal ?? "Configuration incomplète.",
        }
      : { ok: true, definition, draft: false }
  }
  if (source.row.status === "rejected" || source.row.status === "archived")
    return {
      ok: false,
      reason: "incomplete",
      message: sourceTestRefusal(source.row, source.revision)!,
    }
  const parsed = scanSourceFormSchema({
    today: todayInParis(new Date()),
    testSourceUrl: env.SCAN_TEST_SOURCE_URL,
  }).safeParse(values)
  if (!parsed.success)
    return {
      ok: false,
      reason: "incomplete",
      message: "Corrigez les champs signalés avant de tester.",
      fieldErrors: formFieldErrors(parsed.error),
    }
  const strict = scanSourceSnapshotSchema.safeParse(parsed.data.snapshot)
  if (!strict.success)
    return {
      ok: false,
      reason: "incomplete",
      message:
        "Configuration incomplète : connecteur, paramètres, preuve de rattachement et conditions sont nécessaires pour tester.",
    }
  const definition: ScanSourceDefinition = {
    ...strict.data,
    key,
    revision: source.row.revision,
    role: source.row.role,
    priority: source.row.priority,
  }
  const errors = scanSourceDefinitionErrors(definition, scanUrlPolicy)
  if (errors.length || !isSourceAdapterAvailable(definition))
    return {
      ok: false,
      reason: "incomplete",
      message: errors.length
        ? `Configuration incomplète : ${errors.join(" ; ")}.`
        : "Connecteur indisponible sur ce déploiement.",
    }
  return { ok: true, definition, draft: true }
}

// Événement réservé avant la lecture réseau : le délai de recharge vaut aussi pour deux clics
// simultanés.
async function reserveTest(
  key: string,
  kind: SourceTestKind,
  adminId: string,
  details: Record<string, unknown>,
  revision: number,
  now: Date,
): Promise<{ ok: true; id: string } | SourceTestRefusal> {
  return db.transaction(async (tx) => {
    const row = await lockScanSource(tx, key)
    if (!row)
      return { ok: false, reason: "unknown", message: "Source inconnue." }
    const [last] = await tx
      .select({ createdAt: scanSourceEvents.createdAt })
      .from(scanSourceEvents)
      .where(
        and(
          eq(scanSourceEvents.sourceKey, key),
          inArray(scanSourceEvents.kind, [...testEventKinds]),
        ),
      )
      .orderBy(desc(scanSourceEvents.createdAt))
      .limit(1)
    const wait = last
      ? last.createdAt.getTime() +
        scanLimits.sourceTestCooldownMs -
        now.getTime()
      : 0
    if (wait > 0)
      return {
        ok: false,
        reason: "cooldown",
        message: `Patientez ${Math.ceil(wait / 1000)} s avant un nouveau test de cette source.`,
      }
    const id = await recordSourceEvent(
      tx,
      key,
      {
        kind: kind === "probe" ? "probed" : "sampled",
        details: { ...details, status: "running" },
      },
      { actorUserId: adminId, revision, createdAt: now },
    )
    // Rétention : les 20 derniers tests ; les décisions et changements ne sont jamais purgés.
    await tx.execute(sql`
      delete from ${scanSourceEvents} where ${scanSourceEvents.id} in (
        select ${scanSourceEvents.id} from ${scanSourceEvents}
        where ${scanSourceEvents.sourceKey} = ${key}
          and ${scanSourceEvents.kind} in ('probed', 'sampled', 'detected')
        order by ${scanSourceEvents.createdAt} desc
        offset ${scanLimits.sourceTestsKept}
      )`)
    return { ok: true, id }
  })
}

// Résultat borné à 32 Ko : au-delà, les dernières fiches de l'échantillon sont retirées.
function boundedResult<T extends ScanProbeResult | ExtractionSample>(
  result: T,
  base: Record<string, unknown>,
): T {
  const size = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify({ ...base, result: value })).length
  if (size(result) <= 30_000 || !("items" in result)) return result
  const items = [...result.items]
  while (items.length && size({ ...result, items }) > 30_000) items.pop()
  return { ...result, items, truncated: true }
}

export async function runSourceTest(
  key: string,
  kind: SourceTestKind,
  adminId: string,
  { values, now = new Date() }: { values?: SourceFormValues; now?: Date } = {},
): Promise<SourceTestOutcome> {
  const target = await definitionToTest(key, values)
  if (!target.ok) return target
  const { definition, draft } = target
  const configHash = sourceConfigHash(definition)
  const base = {
    configHash,
    environment: deploymentEnvironment(),
    deploymentUrl: deploymentUrl(),
    draft,
  }
  const reserved = await reserveTest(
    key,
    kind,
    adminId,
    base,
    definition.revision,
    now,
  )
  if (!reserved.ok) return reserved
  let outcome: SourceTestOutcome
  let details: Record<string, unknown>
  try {
    if (kind === "probe") {
      const result = await probeScanSource(definition)
      const succeeded = probeSucceeded(result)
      outcome = {
        ok: true,
        kind,
        testId: reserved.id,
        configHash,
        succeeded,
        result,
      }
      details = {
        ...base,
        status: "done",
        ok: succeeded,
        result: boundedResult(result, base),
      }
    } else {
      const result = await sampleScanSource(definition)
      const succeeded = sampleSucceeded(result)
      outcome = {
        ok: true,
        kind,
        testId: reserved.id,
        configHash,
        succeeded,
        result,
      }
      details = {
        ...base,
        status: "done",
        ok: succeeded,
        empty: result.items.length === 0,
        extractorVersion: result.extractorVersion,
        result: boundedResult(result, base),
      }
    }
  } catch (error) {
    await db
      .update(scanSourceEvents)
      .set({
        details: {
          ...base,
          status: "failed",
          ok: false,
          error: "Le test n'a pas abouti.",
        },
      })
      .where(eq(scanSourceEvents.id, reserved.id))
    throw error
  }
  await db
    .update(scanSourceEvents)
    .set({ details })
    .where(eq(scanSourceEvents.id, reserved.id))
  return outcome
}

// Tests conservés d'une source, du plus récent au plus ancien.
export function listSourceTests(key: string) {
  return db
    .select()
    .from(scanSourceEvents)
    .where(
      and(
        eq(scanSourceEvents.sourceKey, key),
        inArray(scanSourceEvents.kind, [...testEventKinds]),
      ),
    )
    .orderBy(desc(scanSourceEvents.createdAt))
}
