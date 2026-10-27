"use client"

import { unstable_rethrow } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatIsoDate } from "@/domain/offer-display"
import { scanFailureLabels } from "@/domain/scan/http"
import type { ScanProbeResult } from "@/domain/scan/probe"
import type { ScanSourceSummary as SourceRow } from "@/domain/scan/source"
import {
  scanSourceKindLabels,
  scanSourceRoleLabels,
  scanSourceStatusLabels,
} from "@/domain/scan/vocabulary"
import { formatDateTime } from "@/lib/format"
import { probeScanSourceAction } from "@/server/scan/actions"
import { ScanSampleButton } from "./scan-sample-button"
import { ScanSourceSwitches } from "./scan-source-switches"

export function ScanSourcesCard({ sources }: { sources: SourceRow[] }) {
  const [selected, setSelected] = useState<SourceRow | null>(null)
  const [result, setResult] = useState<ScanProbeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement | null>(null)

  function probe(source: SourceRow) {
    setSelected(source)
    setResult(null)
    setError(null)
    startTransition(async () => {
      try {
        const response = await probeScanSourceAction(source.key)
        if (response.ok) setResult(response.result)
        else setError(response.message)
      } catch (error) {
        unstable_rethrow(error)
        setError("Le diagnostic n'a pas abouti. Réessayez dans un instant.")
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Sources du scan</h2>
          </CardTitle>
          <CardDescription>
            Vérifiez l’accès aux sources depuis ce déploiement. Le diagnostic
            est temporaire et ne crée aucune annonce.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4">
            {sources.map((source) => (
              <li
                key={source.key}
                className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{source.label}</h3>
                    <Badge
                      variant={
                        source.status === "ready" ? "default" : "outline"
                      }
                    >
                      {scanSourceStatusLabels[source.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {scanSourceRoleLabels[source.role]} ·{" "}
                    {scanSourceKindLabels[source.kind]}
                  </p>
                </div>
                {source.kind === "discovery" && (
                  <p className="text-sm text-muted-foreground">
                    La source officielle de l’employeur reste à retrouver avant
                    publication.
                  </p>
                )}
                {source.officialHosts.length > 0 && (
                  <p className="text-sm wrap-anywhere">
                    Hôtes officiels : {source.officialHosts.join(", ")}
                  </p>
                )}
                {source.checkedAt && (
                  <p className="text-sm">
                    Vérification documentée : {formatIsoDate(source.checkedAt)}
                  </p>
                )}
                {source.testable && (
                  <Button
                    variant="outline"
                    className="h-auto w-full whitespace-normal sm:w-fit"
                    disabled={pending}
                    onClick={(event) => {
                      trigger.current = event.currentTarget
                      probe(source)
                    }}
                  >
                    Tester l’accès depuis ce déploiement
                    <span className="sr-only"> — {source.label}</span>
                  </Button>
                )}
                {source.status !== "rejected" && (
                  <ScanSourceSwitches source={source} />
                )}
                {source.testable && <ScanSampleButton source={source} />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <SheetContent
          className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <SheetHeader>
            <SheetTitle>Diagnostic — {selected?.label}</SheetTitle>
            <SheetDescription>
              Liste et jusqu’à trois fiches, selon l’accès autorisé par la
              source.
            </SheetDescription>
          </SheetHeader>
          <div
            className="flex flex-col gap-4 px-4 pb-6 text-sm"
            aria-live="polite"
            aria-busy={pending}
          >
            {pending && <p>Lecture de la source en cours…</p>}
            {error && <p role="alert">{error}</p>}
            {result && (
              <>
                <p className="wrap-anywhere">
                  Déploiement : {result.deploymentUrl}
                  <br />
                  Sonde du {formatDateTime(result.probedAt)}
                </p>
                {result.requests.map((request, index) => (
                  <section
                    key={`${index}-${request.url}`}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <h3 className="font-medium">
                      {request.kind === "list" ? "Liste" : "Fiche"} —{" "}
                      {request.ok ? "Accessible" : "Échec"}
                    </h3>
                    <p className="wrap-anywhere">URL : {request.url}</p>
                    {request.pageUrl && (
                      <p className="wrap-anywhere">
                        Fiche publique : {request.pageUrl}
                      </p>
                    )}
                    {request.finalUrl && (
                      <p className="wrap-anywhere">
                        URL finale : {request.finalUrl}
                      </p>
                    )}
                    <p>
                      HTTP : {request.status ?? "sans réponse"} · échanges{" "}
                      {request.elapsedMs} ms · attente de politesse{" "}
                      {request.waitedMs} ms ·{" "}
                      {request.bytes === undefined
                        ? "taille non mesurée"
                        : `${request.bytes} octets`}
                    </p>
                    {request.reason && (
                      <p>Motif : {scanFailureLabels[request.reason]}</p>
                    )}
                    {request.robots.map((robots, index) => (
                      <p key={index} className="wrap-anywhere">
                        robots.txt :{" "}
                        {robots.allowed
                          ? "autorisé"
                          : robots.reason
                            ? `indisponible (${scanFailureLabels[robots.reason]})`
                            : "interdit"}{" "}
                        (HTTP {robots.status ?? "sans réponse"}, délai{" "}
                        {robots.crawlDelayMs} ms) — {robots.url}
                      </p>
                    ))}
                    <p>
                      JSON-LD JobPosting :{" "}
                      {request.jobPosting === "valid"
                        ? "présent"
                        : request.jobPosting === "invalid_json"
                          ? "présent, JSON invalide"
                          : "absent"}
                    </p>
                    <p>
                      Éléments RSS : {request.rssItems} · Liens de fiche :{" "}
                      {request.postingLinks} · Pagination détectée :{" "}
                      {request.pagination ? "oui" : "non"}
                    </p>
                  </section>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
