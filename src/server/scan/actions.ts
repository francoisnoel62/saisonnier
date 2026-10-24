"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/dal"

import { probeScanSource } from "./probe"
import { sampleScanSource } from "./sample"
import { scanSourceDefinitions } from "./sources/registry"
import {
  isScanSourceKey,
  setScanSourceEnabled,
  setScanSourceAutoPublish,
} from "./sources/state"

export async function probeScanSourceAction(key: string) {
  await requireRole("admin")
  if (typeof key !== "string" || !Object.hasOwn(scanSourceDefinitions, key)) {
    return { ok: false as const, message: "Source inconnue." }
  }
  return {
    ok: true as const,
    result: await probeScanSource(scanSourceDefinitions[key]),
  }
}

export async function sampleScanSourceAction(key: string) {
  await requireRole("admin")
  if (typeof key !== "string" || !Object.hasOwn(scanSourceDefinitions, key))
    return { ok: false as const, message: "Source inconnue." }
  return {
    ok: true as const,
    result: await sampleScanSource(scanSourceDefinitions[key]),
  }
}

export async function setScanSourceEnabledAction(
  key: string,
  enabled: boolean,
) {
  const { user } = await requireRole("admin")
  if (!isScanSourceKey(key) || typeof enabled !== "boolean")
    return { ok: false, message: "Source ou état invalide." } as const
  await setScanSourceEnabled(key, enabled, user.id)
  revalidatePath("/admin/scan")
  return { ok: true } as const
}

export async function setScanSourceAutoPublishAction(
  key: string,
  enabled: boolean,
) {
  const { user } = await requireRole("admin")
  if (!isScanSourceKey(key) || typeof enabled !== "boolean")
    return { ok: false, message: "Source ou état invalide." } as const
  await setScanSourceAutoPublish(key, enabled, user.id)
  revalidatePath("/admin/scan")
  return { ok: true } as const
}
