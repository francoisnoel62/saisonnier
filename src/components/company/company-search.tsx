"use client"

import { Building2Icon, Loader2Icon, SearchIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { COMPANY_SEARCH_MIN_LENGTH } from "@/domain/membership"
import type {
  CompanySuggestion,
  DirectorySearch,
} from "@/server/companies/directory"

type SearchStatus =
  | { kind: "idle" }
  | { kind: "done"; results: CompanySuggestion[] }
  | { kind: "unavailable" }

const countLabel = (count: number) =>
  count === 0
    ? "Aucune entreprise trouvée : vérifiez la saisie, ou remplissez le formulaire à la main."
    : `${count} entreprise${count > 1 ? "s" : ""} trouvée${count > 1 ? "s" : ""}`

// Recherche dans l'annuaire des entreprises, par nom ou par numéro SIREN / SIRET. Partagée par
// l'onboarding employeur et l'assistant d'ajout d'une source du scan.
export function CompanySearch({
  search,
  onChoose,
  title = "Retrouver votre entreprise",
  unavailable = "La recherche est momentanément indisponible : saisissez votre entreprise à la main.",
}: {
  search: (query: string) => Promise<DirectorySearch>
  onChoose: (suggestion: CompanySuggestion) => void
  title?: string
  unavailable?: string
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" })
  const [chosen, setChosen] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const tooShort = query.trim().length < COMPANY_SEARCH_MIN_LENGTH

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (tooShort) return
    startTransition(async () => {
      const result = await search(query).catch(() => ({ ok: false }) as const)
      setChosen(null)
      setStatus(
        result.ok
          ? { kind: "done", results: result.results }
          : { kind: "unavailable" },
      )
    })
  }

  return (
    <section
      aria-labelledby="company-search-title"
      className="flex flex-col gap-3"
    >
      <h2 id="company-search-title" className="font-medium">
        {title}
      </h2>
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label htmlFor="company-search" className="sr-only">
          Nom de l&rsquo;entreprise, SIREN ou SIRET
        </label>
        <Input
          id="company-search"
          type="search"
          placeholder="Nom, SIREN ou SIRET"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={tooShort || pending}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <SearchIcon aria-hidden />
          )}
          Rechercher
        </Button>
      </form>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status.kind === "unavailable" && unavailable}
        {status.kind === "done" && countLabel(status.results.length)}
      </p>

      {status.kind === "done" && status.results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {status.results.map((suggestion) => {
            const key = suggestion.siret ?? suggestion.siren
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-2">
                  <Building2Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {suggestion.legalName}
                      {suggestion.displayName && ` (${suggestion.displayName})`}
                    </p>
                    <p className="text-muted-foreground">
                      SIREN {suggestion.siren}
                      {suggestion.communeName && ` · ${suggestion.communeName}`}
                      {suggestion.nafCode && ` · ${suggestion.nafCode}`}
                      {suggestion.nafLabel && ` ${suggestion.nafLabel}`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={chosen === key ? "default" : "outline"}
                  aria-pressed={chosen === key}
                  onClick={() => {
                    setChosen(key)
                    onChoose(suggestion)
                  }}
                >
                  {chosen === key ? "Choisie" : "Choisir"}
                  <span className="sr-only"> {suggestion.legalName}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
