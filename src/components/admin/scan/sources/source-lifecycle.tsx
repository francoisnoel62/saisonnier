"use client"

import Link from "next/link"
import { unstable_rethrow, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  rejectionReasonBounds,
  sourceTransitionLabels,
  type SourceTransition,
} from "@/domain/scan/source-lifecycle"
import {
  deleteScanSourceAction,
  transitionScanSourceAction,
} from "@/server/scan/sources/actions"

export type LifecycleSource = {
  key: string
  label: string
  version: number
  pendingCandidates: number
}
type Dialogged = "reject" | "archive" | "delete"

// Écarter, archiver, supprimer, et les transitions sans saisie (§10.1, §11.5). Les refus du
// serveur s'affichent tels quels ; une source avec historique propose l'archivage.
export function useSourceLifecycle(
  source: LifecycleSource,
  { afterDelete = "/admin/scan/sources" }: { afterDelete?: string } = {},
) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialogged | null>(null)
  const [reason, setReason] = useState("")
  const [rejectPending, setRejectPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inUse, setInUse] = useState(false)
  const [pending, startTransition] = useTransition()

  function run(
    transition: SourceTransition,
    payload: { reason?: string; rejectPending?: boolean } = {},
  ) {
    if (pending) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await transitionScanSourceAction(
          source.key,
          source.version,
          transition,
          payload,
        )
        if (result.ok) {
          toast.success(`${sourceTransitionLabels[transition]} : fait.`)
          setDialog(null)
        } else if (dialog) setError(result.message)
        else toast.error(result.message)
      } catch (error) {
        unstable_rethrow(error)
        const message = "L’action n’a pas abouti. Réessayez dans un instant."
        if (dialog) setError(message)
        else toast.error(message)
      }
    })
  }
  function remove() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteScanSourceAction(source.key)
        if (result.ok) {
          toast.success("Source supprimée.")
          setDialog(null)
          router.push(afterDelete)
        } else {
          setInUse(result.reason === "in_use")
          setError(result.message)
        }
      } catch (error) {
        unstable_rethrow(error)
        setError("La suppression n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }
  function request(transition: SourceTransition | "delete") {
    setError(null)
    setInUse(false)
    if (transition === "reject" || transition === "archive") {
      setReason("")
      setRejectPending(false)
      setDialog(transition)
    } else if (transition === "delete") setDialog("delete")
    else run(transition)
  }

  const dialogs = (
    <>
      <Dialog
        open={dialog === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              run("reject", { reason })
            }}
          >
            <DialogHeader>
              <DialogTitle>Écarter « {source.label} »</DialogTitle>
              <DialogDescription>
                La source ne sera plus lue ; ses dossiers à vérifier ne pourront
                plus être publiés. Vous pourrez la réexaminer.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor={`reject-${source.key}`}>Motif</FieldLabel>
              <Textarea
                id={`reject-${source.key}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={rejectionReasonBounds.min}
                maxLength={rejectionReasonBounds.max}
                required
                aria-describedby={`reject-${source.key}-hint`}
              />
              <FieldDescription id={`reject-${source.key}-hint`}>
                De {rejectionReasonBounds.min} à {rejectionReasonBounds.max}{" "}
                caractères. Exemples : robots.txt refuse notre robot, CGU
                restrictives, liste construite par JavaScript, hors périmètre.
              </FieldDescription>
            </Field>
            {error && <FormAlert>{error}</FormAlert>}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Écarter la source
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archiver « {source.label} »</DialogTitle>
            <DialogDescription>
              La source ne sera plus lue. Ses dossiers restent consultables et
              traitables, ses annonces publiées ne changent pas. Vous pourrez la
              restaurer.
            </DialogDescription>
          </DialogHeader>
          {source.pendingCandidates > 0 && (
            <Field orientation="horizontal">
              <Checkbox
                id={`archive-pending-${source.key}`}
                checked={rejectPending}
                onCheckedChange={(checked) =>
                  setRejectPending(checked === true)
                }
              />
              <FieldLabel htmlFor={`archive-pending-${source.key}`}>
                Rejeter aussi ses {source.pendingCandidates} dossier
                {source.pendingCandidates > 1 ? "s" : ""} à vérifier
              </FieldLabel>
            </Field>
          )}
          {error && <FormAlert>{error}</FormAlert>}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => run("archive", { rejectPending })}
            >
              Archiver la source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {source.label} »</DialogTitle>
            <DialogDescription>
              Seule une source sans historique (passage, dossier ou revue) se
              supprime, avec ses versions et son journal. Cette action est
              définitive.
            </DialogDescription>
          </DialogHeader>
          {error && <FormAlert>{error}</FormAlert>}
          <DialogFooter>
            {inUse ? (
              <Button disabled={pending} onClick={() => request("archive")}>
                Archiver
              </Button>
            ) : (
              <Button variant="destructive" disabled={pending} onClick={remove}>
                Supprimer définitivement
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
  return { request, pending, dialogs }
}

export function SourceEditLink({ sourceKey }: { sourceKey: string }) {
  return (
    <Button asChild variant="outline" className="w-full sm:w-fit">
      <Link href={`/admin/scan/sources/${sourceKey}/modifier`}>Modifier</Link>
    </Button>
  )
}
