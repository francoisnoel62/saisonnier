"use client"

import { unstable_rethrow } from "next/navigation"
import { useRef, useState, useTransition } from "react"

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
import type { ScanProbeResult } from "@/domain/scan/probe"
import { formatDateTime } from "@/lib/format"
import { probeScanSourceAction } from "@/server/scan/actions"

type SourceRow = {
  key: string
  label: string
  role: "primary" | "reserve"
  officialHosts: string[]
  checkedAt: string
}

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
                <div>
                  <h3 className="font-medium">{source.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {source.role === "primary" ? "Principale" : "Réserve"}
                  </p>
                </div>
                <p className="text-sm wrap-anywhere">
                  Hôtes officiels : {source.officialHosts.join(", ")}
                </p>
                <p className="text-sm">
                  Vérification documentée :{" "}
                  {new Intl.DateTimeFormat("fr-FR").format(
                    new Date(`${source.checkedAt}T12:00:00Z`),
                  )}
                </p>
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
                    {request.finalUrl && (
                      <p className="wrap-anywhere">
                        URL finale : {request.finalUrl}
                      </p>
                    )}
                    <p>
                      HTTP : {request.status ?? "sans réponse"} ·{" "}
                      {request.elapsedMs} ms · {request.bytes ?? 0} octets
                    </p>
                    {request.reason && <p>Motif : {request.reason}</p>}
                    {request.robots.map((robots, index) => (
                      <p key={index} className="wrap-anywhere">
                        robots.txt :{" "}
                        {robots.allowed
                          ? "autorisé"
                          : "indisponible ou interdit"}{" "}
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
