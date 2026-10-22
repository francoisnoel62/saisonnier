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
import { formatDateTime } from "@/lib/format"
import { setDailyJobEnabled } from "@/server/jobs/actions"

// Tâche quotidienne (plan 16) : le fondateur l'active ou la désactive, et voit son dernier passage.
export function DailyJobCard({
  enabled: initialEnabled,
  lastRun,
  updated,
}: {
  enabled: boolean
  // Dernier passage exécuté : sa date (ISO) et son résumé.
  lastRun: { at: string; summary: string } | null
  // Dernier changement d'état : sa date (ISO) et son auteur.
  updated: { at: string; by: string | null } | null
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    if (pending) return
    setEnabled(next)
    startTransition(async () => {
      try {
        await setDailyJobEnabled(next)
        toast.success(
          next
            ? "Tâche quotidienne activée : elle s'exécutera cette nuit."
            : "Tâche quotidienne désactivée : plus rien ne s'exécute la nuit.",
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Tâche quotidienne</h2>
        </CardTitle>
        <CardDescription>
          Chaque nuit à 3 h UTC (4 h ou 5 h à Paris selon l&rsquo;heure
          d&rsquo;été) : les annonces dont l&rsquo;échéance est passée
          deviennent « expirées », et les déposants reçoivent le rappel de
          validité à 30 jours. Sans réponse, une annonce reste en ligne.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <Field orientation="horizontal">
          <Switch
            id="tache-quotidienne"
            checked={enabled}
            onCheckedChange={toggle}
            aria-busy={pending}
            aria-describedby="tache-quotidienne-etat"
          />
          <FieldLabel htmlFor="tache-quotidienne">
            Tâche quotidienne activée
          </FieldLabel>
        </Field>
        <FieldDescription id="tache-quotidienne-etat" aria-live="polite">
          {enabled
            ? "Active : elle s'exécute chaque nuit."
            : "Désactivée : la route du cron répond sans rien exécuter."}
          {updated &&
            ` Modifiée le ${formatDateTime(updated.at)}${updated.by ? ` par ${updated.by}` : ""}.`}
        </FieldDescription>
        <p>
          <span className="font-medium">Dernier passage : </span>
          {lastRun
            ? `${formatDateTime(lastRun.at)} — ${lastRun.summary}.`
            : "aucun pour l'instant."}
        </p>
      </CardContent>
    </Card>
  )
}
