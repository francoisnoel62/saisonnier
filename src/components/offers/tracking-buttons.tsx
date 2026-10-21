"use client"

import { BookmarkIcon, CircleCheckIcon } from "lucide-react"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  declareApplied,
  toggleSaved,
  undoApplied,
  type TrackingResult,
} from "@/server/candidates/tracking-actions"

function reportFailure(result: TrackingResult) {
  if (!result.ok) toast.error(result.message)
}

const failed = () =>
  toast.error("L'action n'a pas abouti. Vérifiez votre connexion et réessayez.")

// Sauvegarder une offre : l'état change tout de suite, le serveur suit.
export function SaveOfferButton({
  offerId,
  title,
  saved,
  withLabel = false,
  className,
}: {
  offerId: string
  title: string
  saved: boolean
  withLabel?: boolean
  className?: string
}) {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !optimisticSaved
    startTransition(async () => {
      setOptimisticSaved(next)
      await toggleSaved(offerId, next).then(reportFailure, failed)
    })
  }

  const label = optimisticSaved
    ? `Retirer « ${title} » des offres sauvegardées`
    : `Sauvegarder « ${title} »`

  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "lg" : "icon-lg"}
      aria-pressed={optimisticSaved}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={className}
    >
      <BookmarkIcon
        className={cn(optimisticSaved && "fill-current")}
        data-icon={withLabel ? "inline-start" : undefined}
        aria-hidden
      />
      {withLabel && (optimisticSaved ? "Sauvegardée" : "Sauvegarder")}
    </Button>
  )
}

// « J'ai postulé » : une déclaration du candidat, jamais déduite d'un clic sur un contact (§5).
export function AppliedButton({
  offerId,
  appliedAt,
}: {
  offerId: string
  appliedAt: Date | null
}) {
  const [optimisticAppliedAt, setOptimisticAppliedAt] = useOptimistic(appliedAt)
  const [, startTransition] = useTransition()

  function declare() {
    startTransition(async () => {
      setOptimisticAppliedAt(new Date())
      await declareApplied(offerId).then(reportFailure, failed)
    })
  }
  function undo() {
    startTransition(async () => {
      setOptimisticAppliedAt(null)
      await undoApplied(offerId).then(reportFailure, failed)
    })
  }

  if (!optimisticAppliedAt) {
    return (
      <Button type="button" variant="secondary" size="lg" onClick={declare}>
        <CircleCheckIcon data-icon="inline-start" aria-hidden />
        J&rsquo;ai postulé
      </Button>
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm" role="status">
      <CircleCheckIcon className="size-4 text-primary" aria-hidden />
      Vous avez indiqué avoir postulé le {formatDate(optimisticAppliedAt)}
      <span aria-hidden>·</span>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        onClick={undo}
        aria-label="Annuler la déclaration « J'ai postulé »"
      >
        Annuler
      </Button>
    </p>
  )
}
