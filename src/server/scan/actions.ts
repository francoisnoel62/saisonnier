"use server"

import { requireRole } from "@/lib/dal"

import { probeScanSource } from "./probe"
import { scanSourceDefinitions } from "./sources/registry"

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
