"use server"

import { revalidatePath } from "next/cache"

import { isScheduledJobName } from "@/domain/scheduled-job"
import { requireRole } from "@/lib/dal"

import { setScheduledJobEnabled } from "./settings"

// Active ou désactive une tâche planifiée : désactivée, sa route répond sans rien exécuter.
export async function setScheduledJobEnabledAction(
  name: string,
  enabled: boolean,
) {
  const { user } = await requireRole("admin")
  if (!isScheduledJobName(name)) {
    return { ok: false, message: "Cette tâche n'existe pas." } as const
  }
  await setScheduledJobEnabled(name, enabled === true, user.id)
  revalidatePath("/admin")
  return { ok: true } as const
}
