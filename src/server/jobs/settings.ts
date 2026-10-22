import "server-only"

import { eq } from "drizzle-orm"

import {
  scheduledJobNames,
  type ScheduledJobName,
  type ScheduledJobSummaries,
} from "@/domain/scheduled-job"
import { db } from "@/lib/db"
import { scheduledJobs, user } from "@/lib/db/schema"

// État des tâches planifiées (plan 16). Une tâche du registre sans ligne en base est active.

const stateColumns = {
  name: scheduledJobs.name,
  enabled: scheduledJobs.enabled,
  enabledChangedAt: scheduledJobs.enabledChangedAt,
  updatedByName: user.name,
  lastRunAt: scheduledJobs.lastRunAt,
  lastSummary: scheduledJobs.lastSummary,
}

export type ScheduledJobState = {
  name: ScheduledJobName
  enabled: boolean
  // Dernier changement d'état par un admin.
  enabledChangedAt: Date | null
  updatedByName: string | null
  // Dernier passage exécuté.
  lastRunAt: Date | null
  lastSummary: ScheduledJobSummaries[ScheduledJobName] | null
}

const defaultState = (name: ScheduledJobName): ScheduledJobState => ({
  name,
  enabled: true,
  enabledChangedAt: null,
  updatedByName: null,
  lastRunAt: null,
  lastSummary: null,
})

// Toutes les tâches du registre, dans son ordre, avec leur état.
export async function listScheduledJobs(): Promise<ScheduledJobState[]> {
  const rows = await db
    .select(stateColumns)
    .from(scheduledJobs)
    .leftJoin(user, eq(user.id, scheduledJobs.updatedByUserId))
  return scheduledJobNames.map(
    (name) => rows.find((row) => row.name === name) ?? defaultState(name),
  )
}

export async function getScheduledJob(
  name: ScheduledJobName,
): Promise<ScheduledJobState> {
  const [row] = await db
    .select(stateColumns)
    .from(scheduledJobs)
    .leftJoin(user, eq(user.id, scheduledJobs.updatedByUserId))
    .where(eq(scheduledJobs.name, name))
  return row ?? defaultState(name)
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
export async function recordScheduledJobRun<Name extends ScheduledJobName>(
  name: Name,
  summary: ScheduledJobSummaries[Name],
  now: Date,
) {
  const run = { lastRunAt: now, lastSummary: summary }
  await db
    .insert(scheduledJobs)
    .values({ name, ...run })
    .onConflictDoUpdate({ target: scheduledJobs.name, set: run })
}
