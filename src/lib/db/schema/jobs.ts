import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import type {
  ScheduledJobName,
  ScheduledJobSummaries,
} from "@/domain/scheduled-job"

import { user } from "./auth"
import { timestamps } from "./columns"

// Tâches planifiées (plan 16) : une ligne par tâche du registre (scheduledJobDefinitions), créée
// au premier changement ou au premier passage. Sans ligne, la tâche est active.
export const scheduledJobs = pgTable("scheduled_jobs", {
  // Nom de la tâche dans le registre : "daily" (expiration et rappels de validité)…
  name: text().$type<ScheduledJobName>().primaryKey(),
  enabled: boolean().notNull().default(true),
  // Dernier admin à l'avoir activée ou désactivée, et quand.
  updatedByUserId: text().references(() => user.id, { onDelete: "set null" }),
  enabledChangedAt: timestamp({ withTimezone: true }),
  // Dernier passage exécuté, et son résumé.
  lastRunAt: timestamp({ withTimezone: true }),
  lastSummary: jsonb().$type<ScheduledJobSummaries[ScheduledJobName]>(),
  ...timestamps,
})

export type ScheduledJob = typeof scheduledJobs.$inferSelect
