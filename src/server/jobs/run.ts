import "server-only"

import type {
  ScheduledJobName,
  ScheduledJobSummaries,
} from "@/domain/scheduled-job"

import { getScheduledJob, recordScheduledJobRun } from "./settings"

export type ScheduledJobResult<Name extends ScheduledJobName> =
  { ran: false } | { ran: true; summary: ScheduledJobSummaries[Name] }

// Exécute une tâche planifiée si l'admin ne l'a pas désactivée, puis enregistre et journalise son
// passage. La route qui l'appelle a déjà vérifié le secret du cron.
export async function runScheduledJob<Name extends ScheduledJobName>(
  name: Name,
  run: () => Promise<ScheduledJobSummaries[Name]>,
  now = new Date(),
): Promise<ScheduledJobResult<Name>> {
  if (!(await getScheduledJob(name)).enabled) {
    console.info(
      `[cron ${name}] désactivée depuis l'admin : rien n'est exécuté.`,
    )
    return { ran: false }
  }
  const summary = await run()
  await recordScheduledJobRun(name, summary, now)
  console.info(`[cron ${name}] ${JSON.stringify(summary)}`)
  return { ran: true, summary }
}
