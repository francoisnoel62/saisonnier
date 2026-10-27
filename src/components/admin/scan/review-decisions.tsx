"use client"

import Link from "next/link"
import { unstable_rethrow, useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  rejectionReasonLabels,
  rejectionReasons,
  type RejectionReason,
} from "@/domain/scan/vocabulary"
import {
  decideDuplicateAction,
  rejectScanCandidate,
} from "@/server/scan/review-actions"

export function ReviewDecisions({
  candidateId,
  version,
  next,
  duplicates,
}: {
  candidateId: string
  version: number
  next: string
  duplicates: { id: string; title: string; href: string }[]
}) {
  const router = useRouter()
  const [closed, setClosed] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<RejectionReason>("missing_minimum")
  const [note, setNote] = useState("")
  function duplicate(id: string, decision: "distinct" | "duplicate") {
    setError(null)
    startTransition(async () => {
      try {
        const result = await decideDuplicateAction(
          id,
          decision,
          undefined,
          candidateId,
        )
        if (!result.ok) {
          setError(result.message)
          return
        }
        setClosed((previous) => [...previous, id])
        if (decision === "duplicate") router.push(next)
      } catch (error) {
        unstable_rethrow(error)
        setError("La décision n’a pas abouti. Réessayez.")
      }
    })
  }
  function reject() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await rejectScanCandidate(
          candidateId,
          version,
          reason,
          note,
        )
        if (!result.ok) {
          setError(result.message)
          return
        }
        setOpen(false)
        router.push(result.next)
      } catch (error) {
        unstable_rethrow(error)
        setError("Le rejet n’a pas abouti. Réessayez.")
      }
    })
  }
  return (
    <div className="grid gap-4">
      {duplicates.length > 0 && (
        <section className="grid gap-3 rounded-lg border p-4">
          <h2 className="font-semibold">Doublons potentiels</h2>
          {duplicates.map((review) => (
            <div key={review.id} className="grid gap-2 border-t pt-3">
              <Link className="underline" href={review.href}>
                {review.title}
              </Link>
              {closed.includes(review.id) ? (
                <p>Recrutements distincts : décision enregistrée.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => duplicate(review.id, "distinct")}
                  >
                    Ce sont deux recrutements distincts
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() => duplicate(review.id, "duplicate")}
                  >
                    Doublon : rejeter ce dossier
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Rejeter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter ce dossier</DialogTitle>
              <DialogDescription>
                Le dossier restera consultable avec le motif et la décision.
                Aucune annonce existante ne sera modifiée.
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-2 text-sm">
              Motif du rejet
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as RejectionReason)
                }
              >
                {rejectionReasons.map((value) => (
                  <option key={value} value={value}>
                    {rejectionReasonLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Note facultative
              <textarea
                className="min-h-24 rounded-md border p-3"
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" disabled={pending} onClick={reject}>
                Confirmer le rejet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button asChild variant="outline">
          <Link href={next}>Dossier suivant</Link>
        </Button>
      </div>
      {error && !open && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
