import "server-only"

import { db } from "@/lib/db"
import { scanSources } from "@/lib/db/schema"

import { scanSourceDefinitions, scanSourceSummaries } from "./registry"

export async function listScanSources() {
  const states = new Map(
    (await db.select().from(scanSources)).map((state) => [state.key, state]),
  )
  return scanSourceSummaries().map((source) => ({
    ...source,
    enabled: states.get(source.key)?.enabled ?? false,
    autoPublish: states.get(source.key)?.autoPublish ?? false,
  }))
}

export function isScanSourceKey(key: string) {
  return typeof key === "string" && Object.hasOwn(scanSourceDefinitions, key)
}

async function setSourceFlag(
  key: string,
  flag: "enabled" | "autoPublish",
  enabled: boolean,
  adminId: string,
) {
  if (!isScanSourceKey(key)) throw new RangeError("Source inconnue")
  if (typeof enabled !== "boolean")
    throw new TypeError("État de source invalide")
  await db
    .insert(scanSources)
    .values({ key, [flag]: enabled, updatedByUserId: adminId })
    .onConflictDoUpdate({
      target: scanSources.key,
      set: { [flag]: enabled, updatedByUserId: adminId },
    })
}

export function setScanSourceEnabled(
  key: string,
  enabled: boolean,
  adminId: string,
) {
  return setSourceFlag(key, "enabled", enabled, adminId)
}
export function setScanSourceAutoPublish(
  key: string,
  enabled: boolean,
  adminId: string,
) {
  return setSourceFlag(key, "autoPublish", enabled, adminId)
}
