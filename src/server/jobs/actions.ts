"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/dal"

import { setScheduledJobEnabled } from "./settings"

// Active ou désactive la tâche quotidienne (expiration et rappels de validité) : désactivée, la
// route du cron répond sans rien exécuter.
export async function setDailyJobEnabled(enabled: boolean) {
  const { user } = await requireRole("admin")
  await setScheduledJobEnabled("daily", enabled === true, user.id)
  revalidatePath("/admin")
  return { ok: true, enabled: enabled === true } as const
}
