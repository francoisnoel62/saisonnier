"use client"

import Link from "next/link"
import { useSelectedLayoutSegment } from "next/navigation"

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
  const openedId = useSelectedLayoutSegment()
  const { snapshot, items, error, announcement, refresh } = useScanSnapshot({
    initial,
    openedId,
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
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
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
              <Link
                aria-current={item.id === openedId ? "page" : undefined}
                href={`/admin/scan/dossiers/${item.id}`}
                className={cn(
                  "block rounded-lg border p-3 text-sm hover:bg-muted",
                  item.id === openedId && "border-primary bg-muted",
                )}
              >
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
                    {item.blockingCount} points à vérifier · {item.alertCount}{" "}
                    alertes
                  </span>
                ) : (
                  <span className="mt-1 block">
                    {scanCandidateStatusLabels[item.status]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {snapshot.run && !snapshot.run.active && snapshot.run.finishedAt && (
          <p className="border-t pt-3 text-sm">
            Passage terminé le {formatDateTime(snapshot.run.finishedAt)}
          </p>
        )}
        <Link
          href="/admin/scan/suggestions"
          className="block text-sm underline"
        >
          Suggestions de métiers ({snapshot.counts.suggestions})
        </Link>
        <Link href="/admin/scan" className="block text-sm underline">
          Sources du scan
        </Link>
      </aside>
      <div className={cn("min-w-0", !openedId && "hidden md:block")}>
        {children}
      </div>
    </div>
  )
}
