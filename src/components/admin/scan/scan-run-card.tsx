"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { orchestrationStallMs } from "@/domain/scan/orchestration"
import type { ScanSnapshot } from "@/domain/scan/queue"
import { formatDuration, runProgress } from "@/domain/scan/run-progress"
import {
  scanModeLabels,
  scanRunSourceStatusLabels,
  scanRunStatusLabels,
} from "@/domain/scan/vocabulary"
import {
  launchBootstrapScanAction,
  resumeScanRunAction,
  stopScanRunAction,
} from "@/server/scan/run-actions"

const refreshMs = 5_000
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
})
const at = (value: string | null) =>
  value ? dateTime.format(new Date(value)) : "—"

type Snapshot = Pick<ScanSnapshot, "run" | "counts">

// Carte du passage (plan scan 09) : lancement du premier remplissage, avancement actualisé toutes
// les 5 s pendant un passage actif et visible, arrêt, reprise et relance.
export function ScanRunCard({
  initial,
  bootstrapLaunched,
  runnableSources,
}: {
  initial: Snapshot
  bootstrapLaunched: boolean
  // Sources lues par un remplissage initial (prêtes, activées, non suspendues).
  runnableSources: number
}) {
  const [snapshot, setSnapshot] = useState(initial)
  const [launched, setLaunched] = useState(bootstrapLaunched)
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(() => new Date())
  const reading = useRef(false)
  const run = snapshot.run

  const refresh = useCallback(async () => {
    if (reading.current || document.visibilityState !== "visible") return
    reading.current = true
    try {
      const response = await fetch("/api/admin/scan/etat?limite=1", {
        cache: "no-store",
      })
      if (response.ok) {
        const next = (await response.json()) as ScanSnapshot
        setSnapshot({ run: next.run, counts: next.counts })
        if (next.run?.mode === "bootstrap") setLaunched(true)
      }
    } catch {
      // Réseau momentané : la lecture suivante réessaie.
    } finally {
      reading.current = false
      setNow(new Date())
    }
  }, [])

  useEffect(() => {
    if (!run?.active) return
    const timer = setInterval(refresh, refreshMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [run?.active, refresh])

  function act(
    action: () => Promise<{ ok: boolean; message?: string }>,
    done: string,
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(done)
      else toast.error(result.message ?? "L’action n’a pas abouti.")
      await refresh()
    })
  }

  const progress = run ? runProgress(run, now) : null
  const stalled =
    !!run?.active &&
    !!run.lastProgressAt &&
    now.getTime() - Date.parse(run.lastProgressAt) > orchestrationStallMs
  const resumable =
    !!run &&
    (["stopped", "partial", "failed"].includes(run.status) ||
      (run.active && (!run.orchestrated || stalled)))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passage du scan</h2>
        </CardTitle>
        <CardDescription>
          La collecte s’exécute en arrière-plan : fermer cet écran ne l’arrête
          pas. Chaque dossier est consultable dès sa livraison.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!launched && (
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              disabled={pending || runnableSources === 0}
              onClick={() =>
                act(
                  launchBootstrapScanAction,
                  "Premier remplissage lancé : les dossiers arrivent dans la file au fil de la collecte.",
                )
              }
            >
              Lancer le premier remplissage
            </Button>
            {runnableSources === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune source activée : activez-en une depuis les sources du
                scan.
              </p>
            )}
          </div>
        )}
        {run ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{scanModeLabels[run.mode]}</span>
              <Badge variant={run.active ? "default" : "secondary"}>
                {scanRunStatusLabels[run.status]}
              </Badge>
              {run.active && !run.orchestrated && (
                <Badge variant="outline">Exécution non démarrée</Badge>
              )}
            </div>
            <dl
              className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
              aria-live="polite"
            >
              <Item label="Début" value={at(run.startedAt)} />
              {run.deadlineAt && (
                <Item
                  label="Échéance (T+6 h)"
                  value={`${at(run.deadlineAt)}${
                    run.active && progress?.remainingMs !== null
                      ? ` · reste ${formatDuration(progress!.remainingMs!)}`
                      : ""
                  }`}
                />
              )}
              <Item
                label="Dossiers livrés pour vérification"
                value={
                  run.targetCount
                    ? `${run.deliveredCount} / ${run.targetCount}`
                    : String(run.deliveredCount)
                }
              />
              {run.targetCount !== null && (
                <Item
                  label="Seuil"
                  value={
                    run.targetReachedAt
                      ? `atteint à ${at(run.targetReachedAt)} (T+${formatDuration(progress!.reachedAfterMs!)})`
                      : `reste à livrer pour atteindre ${run.targetCount} : ${progress!.toDeliver}`
                  }
                />
              )}
              <Item
                label="Premier dossier livré"
                value={
                  run.firstDeliveredAt
                    ? `${at(run.firstDeliveredAt)} (T+${formatDuration(progress!.firstDeliveryAfterMs!)})`
                    : "—"
                }
              />
              <Item
                label="Stock à vérifier"
                value={String(snapshot.counts.toReview)}
              />
              <Item
                label="Annonces publiées depuis le scan"
                value={String(snapshot.counts.published)}
              />
              {run.finishedAt && (
                <Item label="Fin" value={at(run.finishedAt)} />
              )}
            </dl>
            {run.sources.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">Listées</TableHead>
                    <TableHead className="text-right">Lues</TableHead>
                    <TableHead className="text-right">Livrées</TableHead>
                    <TableHead className="text-right">Écartées</TableHead>
                    <TableHead className="text-right">Échecs</TableHead>
                    <TableHead className="text-right">Requêtes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.sources.map((source) => (
                    <TableRow key={source.key}>
                      <TableCell>
                        <Link
                          className="underline"
                          href={`/admin/scan/sources/${source.key}`}
                        >
                          {source.label}
                        </Link>{" "}
                        <span className="text-muted-foreground">
                          v{source.revision}
                        </span>
                        <div>
                          <Link
                            className="text-xs underline"
                            href={`/admin/scan/dossiers?source=${source.key}`}
                          >
                            Ses dossiers
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        {scanRunSourceStatusLabels[source.status]}
                        {source.lastError && (
                          <div className="text-xs text-muted-foreground">
                            {source.lastError}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.listedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.fetchedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.deliveredCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.excludedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.failedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.requestCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          launched || (
            <p className="text-sm text-muted-foreground">
              Aucun passage pour l’instant.
            </p>
          )
        )}
      </CardContent>
      {run && (
        <CardFooter className="flex flex-wrap gap-2">
          {run.active && run.orchestrated && run.status !== "stopping" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                act(
                  () => stopScanRunAction(run.id),
                  "Arrêt demandé : la piste en cours se termine, le reste est gardé pour « Reprendre ».",
                )
              }
            >
              Arrêter
            </Button>
          )}
          {resumable && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                act(
                  () => resumeScanRunAction(run.id),
                  "Passage repris : même échéance, même compteur.",
                )
              }
            >
              {run.active && !run.orchestrated ? "Relancer" : "Reprendre"}
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href={`/admin/scan/passages/${run.id}`}>Bilan</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/scan/passages">Historique des passages</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
