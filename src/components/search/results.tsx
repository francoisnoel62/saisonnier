"use client"

import { LoaderCircleIcon } from "lucide-react"

import { offerCountLabel } from "@/domain/offer-display"
import { cn } from "@/lib/utils"

import { useSearch } from "./search-provider"

// Nombre de résultats, annoncé aux lecteurs d'écran à chaque mise à jour.
export function ResultsHeader({ total }: { total: number }) {
  const { isPending } = useSearch()

  return (
    <div className="flex min-h-8 items-center gap-3">
      <p
        id="resultats-nombre"
        role="status"
        aria-live="polite"
        className="text-lg font-semibold"
      >
        {offerCountLabel(total)}
      </p>
      {isPending && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          Mise à jour…
        </span>
      )}
    </div>
  )
}

// Liste et pagination, estompées pendant que le serveur recalcule les résultats.
export function ResultsRegion({ children }: { children: React.ReactNode }) {
  const { isPending } = useSearch()

  return (
    <div
      id="resultats"
      aria-busy={isPending}
      className={cn(
        "flex flex-col gap-4 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      {children}
    </div>
  )
}
