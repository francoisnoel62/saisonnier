"use client"

import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { decideOccupationAction } from "@/server/scan/review-actions"

type Suggestion = {
  id: string
  title: string
  occurrences: number
  context: string
  candidates: { id: string; title: string | null; offerId: string | null }[]
}
function SuggestionCard({
  suggestion,
  occupations,
  families,
}: {
  suggestion: Suggestion
  occupations: { id: string; label: string }[]
  families: string[]
}) {
  const [occupationId, setOccupationId] = useState("")
  const [label, setLabel] = useState(suggestion.title.slice(0, 100))
  const [family, setFamily] = useState("")
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  function decide(kind: "attach" | "create" | "reject") {
    setMessage(null)
    startTransition(async () => {
      try {
        const decision =
          kind === "attach"
            ? { kind, occupationId }
            : kind === "create"
              ? { kind, input: { label, family } }
              : { kind }
        const result = await decideOccupationAction(suggestion.id, decision)
        if (!result.ok) {
          setMessage(result.message)
          return
        }
        setDone(true)
      } catch (error) {
        unstable_rethrow(error)
        setMessage("La décision n’a pas abouti. Réessayez.")
      }
    })
  }
  return (
    <section className="grid min-w-0 gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">{suggestion.title}</h2>
        <p className="text-sm text-muted-foreground">
          {suggestion.occurrences} occurrences
        </p>
      </div>
      <p className="text-sm whitespace-pre-line">{suggestion.context}</p>
      <ul className="grid gap-1 text-sm">
        {suggestion.candidates.map((candidate) => (
          <li key={candidate.id} className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-11 w-fit max-w-full text-left whitespace-normal"
            >
              <Link href={`/admin/scan/dossiers/${candidate.id}`}>
                {candidate.title ?? "Voir le dossier"}
              </Link>
            </Button>
            {candidate.offerId && (
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-11 w-fit max-w-full text-left whitespace-normal"
              >
                <Link href={`/admin/annonces/${candidate.offerId}/modifier`}>
                  Voir l’annonce
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {done ? (
        <p role="status">Suggestion traitée. La décision est conservée.</p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`occupation-${suggestion.id}`}>
              Métier existant
            </FieldLabel>
            <Select
              value={occupationId}
              onValueChange={setOccupationId}
              disabled={pending}
            >
              <SelectTrigger
                id={`occupation-${suggestion.id}`}
                className="w-full min-w-0"
              >
                <SelectValue placeholder="Choisir un métier actif" />
              </SelectTrigger>
              <SelectContent>
                {occupations.map((occupation) => (
                  <SelectItem key={occupation.id} value={occupation.id}>
                    {occupation.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            className="w-fit"
            disabled={pending || !occupationId}
            onClick={() => decide("attach")}
          >
            Rattacher à un métier existant
          </Button>
          <fieldset className="grid gap-3 border-t pt-4">
            <legend className="pt-4 font-medium">Créer le métier</legend>
            <Field>
              <FieldLabel htmlFor={`occupation-label-${suggestion.id}`}>
                Intitulé du métier
              </FieldLabel>
              <Input
                id={`occupation-label-${suggestion.id}`}
                value={label}
                maxLength={100}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`occupation-family-${suggestion.id}`}>
                Famille existante ou nouvelle
              </FieldLabel>
              <Input
                id={`occupation-family-${suggestion.id}`}
                list={`families-${suggestion.id}`}
                value={family}
                maxLength={60}
                onChange={(event) => setFamily(event.target.value)}
              />
            </Field>
            <datalist id={`families-${suggestion.id}`}>
              {families.map((family) => (
                <option key={family} value={family} />
              ))}
            </datalist>
            <Button
              className="w-fit"
              disabled={pending || !label.trim() || !family.trim()}
              onClick={() => decide("create")}
            >
              Créer le métier et rattacher
            </Button>
          </fieldset>
          <Button
            className="w-fit"
            variant="outline"
            disabled={pending}
            onClick={() => decide("reject")}
          >
            Rejeter la suggestion
          </Button>
          {message && <p role="alert">{message}</p>}
        </>
      )}
    </section>
  )
}
export function OccupationSuggestions(props: {
  suggestions: Suggestion[]
  occupations: { id: string; label: string }[]
  families: string[]
}) {
  return (
    <div className="grid gap-5">
      {props.suggestions.length ? (
        props.suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            occupations={props.occupations}
            families={props.families}
          />
        ))
      ) : (
        <p>Aucune suggestion à traiter.</p>
      )}
    </div>
  )
}
