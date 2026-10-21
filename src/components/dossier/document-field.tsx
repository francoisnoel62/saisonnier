"use client"

import {
  DownloadIcon,
  FileTextIcon,
  LoaderCircleIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DOCUMENT_MAX_BYTES,
  documentLabels,
  documentSlugs,
  type DocumentKind,
} from "@/domain/candidate-dossier"
import { formatDateTime, formatFileSize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { deleteDocument } from "@/server/candidates/dossier-actions"

export type DocumentInfo = {
  filename: string
  size: number | null
  uploadedAt: Date
}

const uploadLabels: Record<DocumentKind, { add: string; replace: string }> = {
  cv: { add: "Ajouter mon CV (PDF)", replace: "Remplacer mon CV" },
  cover_letter: {
    add: "Ajouter ma lettre (PDF)",
    replace: "Remplacer ma lettre",
  },
}

// Un document du dossier : envoi (PDF, 4 Mo), téléchargement par son propriétaire, suppression.
export function DocumentField({
  kind,
  document,
}: {
  kind: DocumentKind
  document: DocumentInfo | null
}) {
  const router = useRouter()
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<"upload" | "delete" | null>(null)
  const [isPending, startTransition] = useTransition()
  const busy = isPending && action !== null
  const slug = documentSlugs[kind]
  const label = documentLabels[kind]

  function upload(file: File) {
    setError(null)
    if (file.size > DOCUMENT_MAX_BYTES) {
      setError(
        "Le fichier dépasse 4 Mo : réduisez sa taille avant de l'envoyer.",
      )
      return
    }
    const body = new FormData()
    body.set("file", file)
    setAction("upload")
    startTransition(async () => {
      const response = await fetch(`/api/dossier/documents?type=${slug}`, {
        method: "POST",
        body,
      }).catch(() => null)
      if (!response?.ok) {
        const payload = await response?.json().catch(() => null)
        setError(payload?.error ?? "L'envoi a échoué. Réessayez.")
        return
      }
      toast.success(`${label} enregistré${kind === "cover_letter" ? "e" : ""}.`)
      router.refresh()
    })
  }

  function remove() {
    setError(null)
    setAction("delete")
    startTransition(async () => {
      await deleteDocument(kind)
      toast.success(`${label} supprimé${kind === "cover_letter" ? "e" : ""}.`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {document ? (
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <FileTextIcon
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-medium break-all">{document.filename}</p>
            <p className="text-sm text-muted-foreground">
              Envoyé le {formatDateTime(document.uploadedAt)}
              {document.size !== null && ` · ${formatFileSize(document.size)}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun document pour l&rsquo;instant.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Le champ fichier reste accessible au clavier ; son libellé sert de bouton. */}
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="peer sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) upload(file)
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            buttonVariants({
              variant: document ? "outline" : "default",
              size: "lg",
            }),
            "cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50",
          )}
        >
          <UploadIcon data-icon="inline-start" aria-hidden />
          {document ? uploadLabels[kind].replace : uploadLabels[kind].add}
        </label>
        {document && (
          <>
            <a
              href={`/api/dossier/documents/${slug}`}
              download
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Télécharger
            </a>
            <Button
              variant="ghost"
              size="lg"
              disabled={busy}
              onClick={remove}
              aria-label={`Supprimer ${kind === "cv" ? "mon CV" : "ma lettre de motivation"}`}
            >
              <Trash2Icon data-icon="inline-start" aria-hidden />
              Supprimer
            </Button>
          </>
        )}
      </div>

      <p role="status" className="text-sm text-muted-foreground">
        {busy && (
          <span className="flex items-center gap-1.5">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            {action === "upload" ? "Envoi en cours…" : "Suppression…"}
          </span>
        )}
      </p>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  )
}
