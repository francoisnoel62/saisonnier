"use server"

import { revalidatePath } from "next/cache"

import type {
  ScanReuseDecision,
  ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import type { SourceFormValues } from "@/domain/scan/source-form"
import type { SourceTransition } from "@/domain/scan/source-lifecycle"
import { requireRole } from "@/lib/dal"

import { runSourceTest, type SourceTestKind } from "./tests"
import {
  createSource,
  decideReuse,
  deleteSource,
  moveSource,
  restoreRevision,
  reviseSource,
  setSourceSwitch,
  transitionSource,
  type SourceWriteResult,
} from "./writes"

// Actions des sources (§12) : rôle admin d'abord, puis validation, puis le service. Un refus
// métier revient en message, jamais en exception ; chaque écriture revalide le scan.
function revalidated<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/admin/scan", "layout")
  return result
}
const invalid = {
  ok: false,
  reason: "invalid",
  message: "Demande invalide.",
} as const

export async function testScanSourceAction(
  key: string,
  kind: SourceTestKind,
  values?: SourceFormValues,
) {
  const { user } = await requireRole("admin")
  if (typeof key !== "string" || (kind !== "probe" && kind !== "sample"))
    return invalid
  return revalidated(await runSourceTest(key, kind, user.id, { values }))
}

export async function setScanSourceSwitchAction(
  key: string,
  version: number,
  flag: ScanSourceSwitch,
  value: boolean,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await setSourceSwitch(key, flag, value, user.id, { version }),
  )
}

export async function createScanSourceAction(values: SourceFormValues) {
  const { user } = await requireRole("admin")
  return revalidated(await createSource(values, user.id))
}

export async function updateScanSourceAction(
  key: string,
  version: number,
  values: SourceFormValues,
  testId?: string,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await reviseSource(key, version, values, user.id, { testId }),
  )
}

export async function transitionScanSourceAction(
  key: string,
  version: number,
  transition: SourceTransition,
  payload: { reason?: string; rejectPending?: boolean } = {},
): Promise<SourceWriteResult> {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(
    await transitionSource(key, version, transition, user.id, payload),
  )
}

export async function decideScanSourceReuseAction(
  key: string,
  version: number,
  decision: {
    decision: ScanReuseDecision
    note: string
    scheduledAccessBasis?: string
  },
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version)) return invalid
  return revalidated(await decideReuse(key, version, decision, user.id))
}

export async function deleteScanSourceAction(key: string) {
  const { user } = await requireRole("admin")
  return revalidated(await deleteSource(key, user.id))
}

export async function restoreScanSourceRevisionAction(
  key: string,
  version: number,
  revision: number,
  testId?: string,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version) || !Number.isSafeInteger(revision))
    return invalid
  return revalidated(
    await restoreRevision(key, version, revision, user.id, { testId }),
  )
}

export async function moveScanSourceAction(
  key: string,
  direction: "up" | "down",
) {
  const { user } = await requireRole("admin")
  if (direction !== "up" && direction !== "down") return invalid
  return revalidated(await moveSource(key, direction, user.id))
}
