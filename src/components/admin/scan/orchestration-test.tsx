"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  orchestrationTestStatusAction,
  startOrchestrationTestAction,
} from "@/server/scan/run-actions"

const pollMs = 2_000
const maxWaitMs = 90_000
const statusLabels: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
}

type TestState =
  | { kind: "idle" }
  | { kind: "running"; runId: string; status: string; since: number }
  | { kind: "done"; runId: string; seconds: number }
  | { kind: "error"; message: string; runId?: string }

// Diagnostic de l'installation de Vercel Workflow (plan scan 09) : un run de deux étapes et
// d'une attente de 5 s doit se terminer en quelques secondes.
export function OrchestrationTestCard() {
  const [state, setState] = useState<TestState>({ kind: "idle" })
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (state.kind !== "running") return
    timer.current = setTimeout(async () => {
      const result = await orchestrationTestStatusAction(state.runId).catch(
        () => null,
      )
      if (!result || !result.ok) {
        setState({
          kind: "error",
          runId: state.runId,
          message: result?.message ?? "Statut du workflow illisible.",
        })
      } else if (result.status === "completed") {
        setState({
          kind: "done",
          runId: state.runId,
          seconds: Math.round((Date.now() - state.since) / 1_000),
        })
      } else if (result.status === "failed" || result.status === "cancelled") {
        setState({
          kind: "error",
          runId: state.runId,
          message: `Le workflow s’est arrêté : ${statusLabels[result.status]}.`,
        })
      } else if (Date.now() - state.since > maxWaitMs) {
        setState({
          kind: "error",
          runId: state.runId,
          message: "Le workflow ne s’est pas terminé en 90 s.",
        })
      } else {
        setState({ ...state, status: result.status })
      }
    }, pollMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  function launch() {
    startTransition(async () => {
      const result = await startOrchestrationTestAction()
      setState(
        result.ok
          ? {
              kind: "running",
              runId: result.runId,
              status: "pending",
              since: Date.now(),
            }
          : { kind: "error", message: result.message },
      )
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Orchestration</h2>
        </CardTitle>
        <CardDescription>
          Vérifie que les passages du scan peuvent s’exécuter en arrière-plan
          sur ce déploiement : deux étapes et une attente de 5 secondes, sans
          lecture de source.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={launch}
          disabled={pending || state.kind === "running"}
        >
          Tester l’orchestration
        </Button>
        <p aria-live="polite" className="text-sm">
          {state.kind === "running" &&
            `Run ${state.runId} : ${statusLabels[state.status] ?? state.status}…`}
          {state.kind === "done" &&
            `Orchestration opérationnelle : run ${state.runId} terminé en ${state.seconds} s.`}
          {state.kind === "error" &&
            `${state.message}${state.runId ? ` (run ${state.runId})` : ""}`}
        </p>
      </CardContent>
    </Card>
  )
}
