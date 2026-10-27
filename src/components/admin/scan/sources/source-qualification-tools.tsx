"use client"

import { unstable_rethrow } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { domainToExclude } from "@/domain/scan/detection"
import {
  createSourceCompanyAction,
  excludeSourceDomainAction,
} from "@/server/scan/sources/actions"

// Outils de la qualification (lot C) : domaine exclu d'une découverte (D6), fiche entreprise
// (SH15) et demande d'autorisation, préparée pour être envoyée par le fondateur.
export function QualificationTools({
  sourceKey,
  uncoveredHosts,
  canCreateCompany,
  authorizationText,
}: {
  sourceKey: string
  uncoveredHosts: string[]
  canCreateCompany: boolean
  authorizationText: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const domains = [...new Set(uncoveredHosts.map(domainToExclude))]

  function run(
    action: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      try {
        const result = await action()
        if (result.ok) {
          toast.success(success)
        } else toast.error(result.message ?? "L’action n’a pas abouti.")
      } catch (error) {
        unstable_rethrow(error)
        toast.error("L’action n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }
  if (!domains.length && !canCreateCompany && !authorizationText) return null
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {domains.map((domain) => (
        <Button
          key={domain}
          variant="outline"
          className="h-auto w-full whitespace-normal sm:w-fit"
          disabled={pending}
          onClick={() =>
            run(
              () => excludeSourceDomainAction(sourceKey, domain),
              `${domain} ajouté aux domaines exclus.`,
            )
          }
        >
          Ajouter {domain} aux domaines exclus
        </Button>
      ))}
      {canCreateCompany && (
        <Button
          variant="outline"
          className="w-full sm:w-fit"
          disabled={pending}
          onClick={() =>
            run(
              () => createSourceCompanyAction(sourceKey),
              "Fiche entreprise liée à la source.",
            )
          }
        >
          Créer la fiche entreprise
        </Button>
      )}
      {authorizationText && (
        <>
          <Button
            ref={trigger}
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => setOpen(true)}
          >
            Préparer la demande d’autorisation
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                trigger.current?.focus()
              }}
            >
              <SheetHeader>
                <SheetTitle>Demande d’autorisation</SheetTitle>
                <SheetDescription>
                  À envoyer depuis votre boîte, puis à consigner dans la
                  décision de reprise.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-6">
                <Textarea
                  aria-label="Texte de la demande"
                  readOnly
                  rows={18}
                  value={authorizationText}
                />
                <Button
                  className="w-full sm:w-fit"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(authorizationText)
                      toast.success("Texte copié.")
                    } catch {
                      toast.error("Copie impossible : sélectionnez le texte.")
                    }
                  }}
                >
                  Copier
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
