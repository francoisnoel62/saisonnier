"use client"

import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  markEmployerWithoutPortalAction,
  rememberPlaceAliasAction,
} from "@/server/scan/sources/actions"

// Boucles d'apprentissage d'un dossier (lot F) : lieu mémorisé pour la source, portail de
// l'employeur ajouté comme source, ou employeur sans portail à inviter.
export function CandidateLearning({
  candidateId,
  sourceLabel,
  placeNames,
  portal,
  employer,
  discovery,
}: {
  candidateId: string
  sourceLabel: string
  placeNames: string[]
  portal: { url: string; host: string } | null
  employer: { name: string; siren: string | null } | null
  discovery: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [place, setPlace] = useState({
    name: placeNames[0] ?? "",
    communeName: "",
    departmentCode: "",
    inseeCode: "",
  })
  if (!placeNames.length && !portal && !(discovery && employer)) return null

  function remember(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await rememberPlaceAliasAction(candidateId, place)
        if (result.ok) toast.success(`Lieu mémorisé pour ${sourceLabel}.`)
        else setError(result.message)
      } catch (error) {
        unstable_rethrow(error)
        setError("L’enregistrement n’a pas abouti.")
      }
    })
  }
  function withoutPortal() {
    startTransition(async () => {
      try {
        const result = await markEmployerWithoutPortalAction(candidateId)
        if (result.ok)
          toast.success("Employeur ajouté aux employeurs à inviter.")
        else toast.error(result.message)
      } catch (error) {
        unstable_rethrow(error)
        toast.error("L’action n’a pas abouti.")
      }
    })
  }
  const wizard = portal
    ? `/admin/scan/sources/nouvelle?${new URLSearchParams({
        url: portal.url,
        dossier: candidateId,
        ...(employer ? { employeur: employer.name } : {}),
        ...(employer?.siren ? { siren: employer.siren } : {}),
      })}`
    : null

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-semibold">Apprendre de ce dossier</h2>
      {placeNames.length > 0 && (
        <form className="flex flex-col gap-3" onSubmit={remember}>
          <h3 className="font-medium">Mémoriser ce lieu pour {sourceLabel}</h3>
          <p className="text-sm text-muted-foreground">
            Le passage suivant établira ce lieu sans revue.
          </p>
          <Field>
            <FieldLabel htmlFor="alias-name">Nom lu sur la source</FieldLabel>
            <Input
              id="alias-name"
              value={place.name}
              onChange={(event) =>
                setPlace({ ...place, name: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="alias-commune">Commune vérifiée</FieldLabel>
            <Input
              id="alias-commune"
              value={place.communeName}
              onChange={(event) =>
                setPlace({ ...place, communeName: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="alias-department">Département</FieldLabel>
            <Input
              id="alias-department"
              value={place.departmentCode}
              onChange={(event) =>
                setPlace({ ...place, departmentCode: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="alias-insee">Code INSEE</FieldLabel>
            <Input
              id="alias-insee"
              inputMode="numeric"
              value={place.inseeCode}
              onChange={(event) =>
                setPlace({ ...place, inseeCode: event.target.value })
              }
            />
          </Field>
          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
            Mémoriser ce lieu
          </Button>
        </form>
      )}
      {(wizard || (discovery && employer)) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {wizard && (
            <Button asChild variant="outline" className="w-full sm:w-fit">
              <Link href={wizard}>Ajouter ce portail comme source</Link>
            </Button>
          )}
          {discovery && employer && (
            <Button
              variant="outline"
              className="h-auto w-full whitespace-normal sm:w-fit"
              disabled={pending}
              onClick={withoutPortal}
            >
              Cet employeur n’a pas de portail carrière
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
