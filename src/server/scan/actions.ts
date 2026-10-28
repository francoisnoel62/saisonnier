"use server"

import { revalidatePath } from "next/cache"

import type { ScanSourceSwitch } from "@/domain/scan/vocabulary"
import { requireRole } from "@/lib/dal"

import { probeScanSource } from "./probe"
import { sampleScanSource } from "./sample"
import {
  definitionFrom,
  loadScanSource,
  sourceTestRefusal,
} from "./sources/registry"
import { setSourceSwitch } from "./sources/writes"

// Sonde et échantillon : version courante complète d'une source testable seulement.
async function testableDefinition(key: unknown) {
  const source = typeof key === "string" ? await loadScanSource(key) : null
  if (!source) return { ok: false as const, message: "Source inconnue." }
  const refusal = sourceTestRefusal(source.row, source.revision)
  const definition = definitionFrom(source.row, source.revision)
  return refusal || !definition
    ? { ok: false as const, message: refusal ?? "Configuration incomplète." }
    : { ok: true as const, definition }
}

export async function probeScanSourceAction(key: string) {
  await requireRole("admin")
  const source = await testableDefinition(key)
  if (!source.ok) return source
  return {
    ok: true as const,
    result: await probeScanSource(source.definition),
  }
}

export async function sampleScanSourceAction(key: string) {
  await requireRole("admin")
  const source = await testableDefinition(key)
  if (!source.ok) return source
  return {
    ok: true as const,
    result: await sampleScanSource(source.definition),
  }
}

export async function setScanSourceSwitchAction(
  key: string,
  version: number,
  flag: ScanSourceSwitch,
  value: boolean,
) {
  const { user } = await requireRole("admin")
  if (!Number.isSafeInteger(version))
    return { ok: false, message: "Source ou état invalide." } as const
  const result = await setSourceSwitch(key, flag, value, user.id, { version })
  if (!result.ok) return { ok: false, message: result.message } as const
  revalidatePath("/admin/scan", "layout")
  return { ok: true, version: result.version } as const
}
