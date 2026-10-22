"use client"

import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import {
  scheduledJobDefinitions,
  type ScheduledJobName,
} from "@/domain/scheduled-job"
import { formatDateTime } from "@/lib/format"
import { setScheduledJobEnabledAction } from "@/server/jobs/actions"

// Tâche planifiée telle que reçue du serveur : dates en ISO, résumé déjà mis en forme.
export type ScheduledJobRow = {
  name: ScheduledJobName
  enabled: boolean
  // Dernier changement d'état : sa date et son auteur.
  changed: { at: string; by: string | null } | null
  // Dernier passage exécuté : sa date et son résumé.
  lastRun: { at: string; summary: string } | null
}

function ScheduledJobItem({ job }: { job: ScheduledJobRow }) {
  const definition = scheduledJobDefinitions[job.name]
  const [enabled, setEnabled] = useState(job.enabled)
  const [pending, startTransition] = useTransition()
  const id = `tache-${job.name}`

  function toggle(next: boolean) {
    if (pending) return
    setEnabled(next)
    startTransition(async () => {
      try {
        const result = await setScheduledJobEnabledAction(job.name, next)
        if (!result.ok) {
          setEnabled(!next)
          toast.error(result.message)
          return
        }
        toast.success(
          next
            ? `${definition.label} activée : elle s'exécutera au prochain passage.`
            : `${definition.label} désactivée : elle ne s'exécute plus.`,
        )
      } catch (error) {
        unstable_rethrow(error)
        setEnabled(!next)
        toast.error(
          "Le changement n'a pas abouti. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{definition.label}</h3>
        <p className="text-muted-foreground">
          {definition.schedule}. {definition.description}
        </p>
      </div>
      <Field orientation="horizontal">
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={toggle}
          aria-busy={pending}
          aria-describedby={`${id}-etat`}
        />
        <FieldLabel htmlFor={id}>{definition.label} activée</FieldLabel>
      </Field>
      <FieldDescription id={`${id}-etat`} aria-live="polite">
        {enabled
          ? "Active : elle s'exécute à chaque passage du cron."
          : "Désactivée : sa route répond sans rien exécuter."}
        {job.changed &&
          ` Modifiée le ${formatDateTime(job.changed.at)}${job.changed.by ? ` par ${job.changed.by}` : ""}.`}
      </FieldDescription>
      <p>
        <span className="font-medium">Dernier passage : </span>
        {job.lastRun
          ? `${formatDateTime(job.lastRun.at)} — ${job.lastRun.summary}.`
          : "aucun pour l'instant."}
      </p>
    </li>
  )
}

// Tâches planifiées (plan 16) : le fondateur les active ou les désactive, sans redéploiement, et
// voit le dernier passage de chacune.
export function ScheduledJobsCard({ jobs }: { jobs: ScheduledJobRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Tâches planifiées</h2>
        </CardTitle>
        <CardDescription>
          Exécutées par Vercel Cron. Une tâche désactivée ne fait plus rien
          jusqu&rsquo;à sa réactivation.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <ScheduledJobItem key={job.name} job={job} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
