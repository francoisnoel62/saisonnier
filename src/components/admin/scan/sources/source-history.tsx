"use client"

import { unstable_rethrow } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScanSourceDraftSnapshot } from "@/domain/scan/source"
import { revisionDiff } from "@/domain/scan/source-form"
import {
  scanReuseDecisionLabels,
  scanSourceEventKindLabels,
  scanSourceStatusLabels,
  scanSourceSwitchLabels,
  type ScanReuseDecision,
  type ScanSourceEventKind,
  type ScanSourceStatus,
  type ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import { formatDateTime } from "@/lib/format"
import { restoreScanSourceRevisionAction } from "@/server/scan/sources/actions"

export type HistoryRevision = {
  revision: number
  definition: ScanSourceDraftSnapshot
  complete: boolean
  note: string | null
  createdAt: string
  author: string
}
export type HistoryEvent = {
  id: string
  kind: ScanSourceEventKind
  revision: number | null
  details: Record<string, unknown>
  createdAt: string
  author: string
}

function show(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  return JSON.stringify(value, null, 2)
}

// Résumé lisible d'un événement du journal (textes rendus comme du texte).
function eventSummary(event: HistoryEvent) {
  const details = event.details
  switch (event.kind) {
    case "switched":
      return `${scanSourceSwitchLabels[details.flag as ScanSourceSwitch] ?? details.flag} : ${details.value ? "activé" : "désactivé"}${details.reason ? ` — ${details.reason}` : ""}`
    case "status_changed":
      return `${details.from ? scanSourceStatusLabels[details.from as ScanSourceStatus] : "—"} → ${scanSourceStatusLabels[details.to as ScanSourceStatus]}${details.reason ? ` — ${details.reason}` : ""}`
    case "reuse_decided":
      return `${scanReuseDecisionLabels[details.decision as ScanReuseDecision]} — ${details.note}`
    case "revised":
      return `Version ${details.revision}${details.restoredFrom ? `, copie de la version ${details.restoredFrom}` : ""}${details.note ? ` — ${details.note}` : ""}`
    case "created":
      return "Version 1"
    case "imported":
      return typeof details.note === "string" ? details.note : ""
    case "probed":
    case "sampled":
      return details.status === "done"
        ? details.ok
          ? "Réussi"
          : "En échec"
        : details.status === "failed"
          ? "Interrompu"
          : "En cours"
    default:
      return ""
  }
}

// Onglet « Historique » : versions (auteur, date, motif, champs modifiés, avant et après) et
// journal. « Revenir à cette version » crée une version N+1.
export function SourceHistory({
  source,
  revisions,
  events,
}: {
  source: { key: string; version: number; revision: number; archived: boolean }
  revisions: HistoryRevision[]
  events: HistoryEvent[]
}) {
  const [pending, startTransition] = useTransition()
  function restore(revision: number) {
    startTransition(async () => {
      try {
        const result = await restoreScanSourceRevisionAction(
          source.key,
          source.version,
          revision,
        )
        if (result.ok) {
          toast.success(
            `Version ${revision} rétablie dans une nouvelle version.`,
          )
        } else
          toast.error(
            "reason" in result && result.reason === "needs_test"
              ? "Cette version change ce qui est lu : ouvrez « Modifier », testez ses réglages, puis enregistrez."
              : result.message,
          )
      } catch (error) {
        unstable_rethrow(error)
        toast.error("Le retour à cette version n’a pas abouti.")
      }
    })
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Versions</h3>
        <ol className="flex flex-col gap-3">
          {revisions.map((revision, index) => {
            const previous = revisions[index + 1]
            const changes = revisionDiff(
              previous?.definition ?? null,
              revision.definition,
            )
            return (
              <li
                key={revision.revision}
                className="flex min-w-0 flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">Version {revision.revision}</h4>
                  {revision.revision === source.revision && (
                    <Badge>Actuelle</Badge>
                  )}
                  {!revision.complete && (
                    <Badge variant="outline">Incomplète</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(revision.createdAt)} · {revision.author}
                </p>
                {revision.note && (
                  <p className="text-sm wrap-anywhere">
                    Motif : {revision.note}
                  </p>
                )}
                {previous && changes.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Champs modifiés :{" "}
                      {changes.map((change) => change.label).join(", ")}
                    </summary>
                    <dl className="mt-2 grid gap-3 text-sm">
                      {changes.map((change) => (
                        <div key={change.field} className="grid gap-1">
                          <dt className="font-medium">{change.label}</dt>
                          <dd className="grid gap-1 sm:grid-cols-2">
                            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs wrap-anywhere whitespace-pre-wrap">
                              Avant : {show(change.before)}
                            </pre>
                            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs wrap-anywhere whitespace-pre-wrap">
                              Après : {show(change.after)}
                            </pre>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                {revision.revision !== source.revision && !source.archived && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-fit"
                    disabled={pending}
                    onClick={() => restore(revision.revision)}
                  >
                    Revenir à cette version
                    <span className="sr-only"> ({revision.revision})</span>
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Journal</h3>
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="min-w-0 border-b pb-2 text-sm">
              <p>
                <span className="font-medium">
                  {scanSourceEventKindLabels[event.kind]}
                </span>{" "}
                · {formatDateTime(event.createdAt)} · {event.author}
              </p>
              <p className="wrap-anywhere text-muted-foreground">
                {eventSummary(event)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
