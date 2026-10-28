"use client"

import Link from "next/link"
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  scanCandidateStatusLabels,
  scanModeLabels,
  scanRunStatusLabels,
} from "@/domain/scan/vocabulary"
import type { ScanSnapshot } from "@/domain/scan/queue"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useScanSnapshot } from "./use-scan-snapshot"

export function ScanQueue({
  initial,
  children,
}: {
  initial: ScanSnapshot
  children: React.ReactNode
}) {
  const source = useSearchParams().get("source")
  return (
    <FilteredQueue
      key={source ?? ""}
      initial={
        source
          ? {
              ...initial,
              items: initial.items.filter((item) => item.sourceKey === source),
            }
          : initial
      }
      source={source}
    >
      {children}
    </FilteredQueue>
  )
}

function FilteredQueue({
  initial,
  source,
  children,
}: {
  initial: ScanSnapshot
  source: string | null
  children: React.ReactNode
}) {
  const openedId = useSelectedLayoutSegment()
  const { snapshot, items, error, announcement, refresh } = useScanSnapshot({
    initial,
    openedId,
    source,
  })
  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside
        aria-label="File des dossiers"
        className={cn("min-w-0 space-y-4", openedId && "hidden md:block")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            À vérifier ({snapshot.counts.toReview})
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => void refresh()}
          >
            Actualiser
          </Button>
        </div>
        <p aria-live="polite" className="text-sm">
          {announcement}
        </p>
        {error && (
          <p role="status" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {snapshot.counts.published} publiés · {snapshot.counts.rejected}{" "}
          rejetés · {snapshot.counts.excluded} écartés
        </p>
        {snapshot.run && (
          <section className="rounded-lg border p-3 text-sm">
            <p>
              {scanModeLabels[snapshot.run.mode]} ·{" "}
              {scanRunStatusLabels[snapshot.run.status]}
            </p>
            <p>
              {snapshot.run.deliveredCount} livrés
              {snapshot.run.targetCount ? ` / ${snapshot.run.targetCount}` : ""}
            </p>
          </section>
        )}
        {items.length === 0 && (
          <p>
            {snapshot.run?.active
              ? "Recherche en cours…"
              : "Aucun dossier à vérifier."}
          </p>
        )}
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Button
                asChild
                variant="outline"
                className={cn(
                  "h-auto min-h-11 w-full justify-start p-3 text-left whitespace-normal",
                  item.id === openedId && "border-primary bg-muted",
                )}
              >
                <Link
                  aria-current={item.id === openedId ? "page" : undefined}
                  href={`/admin/scan/dossiers/${item.id}`}
                >
                  <span className="min-w-0 font-normal wrap-anywhere">
                    <span className="font-medium">{item.title}</span>
                    <span className="mt-1 block text-muted-foreground">
                      {item.companyName ?? "Entreprise à identifier"} ·{" "}
                      {item.location ?? "Lieu à vérifier"}
                    </span>
                    <span className="block text-muted-foreground">
                      {item.sourceLabel}
                    </span>
                    {item.status === "to_review" ? (
                      <span className="mt-1 block">
                        {item.blockingCount} points à vérifier ·{" "}
                        {item.alertCount} alertes
                      </span>
                    ) : (
                      <span className="mt-1 block">
                        {scanCandidateStatusLabels[item.status]}
                      </span>
                    )}
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
        {snapshot.run && !snapshot.run.active && snapshot.run.finishedAt && (
          <p className="border-t pt-3 text-sm">
            Passage terminé le {formatDateTime(snapshot.run.finishedAt)}
          </p>
        )}
        <nav aria-label="Navigation du scan" className="grid gap-2">
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/admin/scan/suggestions">
              <span>
                Suggestions de métiers ({snapshot.counts.suggestions})
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 justify-start">
            <Link href="/admin/scan/sources">Sources du scan</Link>
          </Button>
        </nav>
      </aside>
      <div className={cn("min-w-0", !openedId && "hidden md:block")}>
        {children}
      </div>
    </div>
  )
}
