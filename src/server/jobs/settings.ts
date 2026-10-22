import "server-only"

import { eq } from "drizzle-orm"

import type { DailyJobSummary, ScheduledJobName } from "@/domain/scheduled-job"
import { db } from "@/lib/db"
import { scheduledJobs, user } from "@/lib/db/schema"

// État des tâches planifiées (plan 16). Une tâche sans ligne en base est active.

export async function getScheduledJob(name: ScheduledJobName) {
  const [row] = await db
    .select({
      enabled: scheduledJobs.enabled,
      lastRunAt: scheduledJobs.lastRunAt,
      lastSummary: scheduledJobs.lastSummary,
      enabledChangedAt: scheduledJobs.enabledChangedAt,
      updatedByName: user.name,
    })
    .from(scheduledJobs)
    .leftJoin(user, eq(user.id, scheduledJobs.updatedByUserId))
    .where(eq(scheduledJobs.name, name))
  return (
    row ?? {
      enabled: true,
      lastRunAt: null,
      lastSummary: null,
      enabledChangedAt: null,
      updatedByName: null,
    }
  )
}

export async function setScheduledJobEnabled(
  name: ScheduledJobName,
  enabled: boolean,
  adminId: string,
  now = new Date(),
) {
  const change = { enabled, updatedByUserId: adminId, enabledChangedAt: now }
  await db
    .insert(scheduledJobs)
    .values({ name, ...change })
    .onConflictDoUpdate({ target: scheduledJobs.name, set: change })
}

// Passage exécuté : sa date et son résumé s'affichent dans le tableau de bord de l'admin.
export async function recordDailyJobRun(summary: DailyJobSummary, now: Date) {
  await db
    .insert(scheduledJobs)
    .values({ name: "daily", lastRunAt: now, lastSummary: summary })
    .onConflictDoUpdate({
      target: scheduledJobs.name,
      set: { lastRunAt: now, lastSummary: summary },
    })
}
