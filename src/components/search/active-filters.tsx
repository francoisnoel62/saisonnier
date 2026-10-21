"use client"

import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  activeCriteriaChips,
  type SearchReferentials,
} from "@/domain/search-chips"

import { useSearch } from "./search-provider"

// Critères actifs (§4) : visibles en permanence, retirables un par un ou tous à la fois.
export function ActiveFilters({
  referentials,
}: {
  referentials: SearchReferentials
}) {
  const { criteria, replace } = useSearch()
  const chips = activeCriteriaChips(criteria, referentials)
  if (chips.length === 0) return null

  return (
    <section
      aria-label="Critères actifs"
      className="flex flex-wrap items-center gap-2"
    >
      <ul className="contents">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Badge
              variant="secondary"
              className="h-auto min-h-8 gap-1 py-1 pr-1 pl-3 text-sm whitespace-normal"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => replace(chip.without)}
                aria-label={`Retirer le critère « ${chip.label} »`}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <Button variant="link" onClick={() => replace({})}>
        Tout effacer
      </Button>
    </section>
  )
}

// Retire tous les critères, depuis l'état vide des résultats.
export function ClearFiltersButton() {
  const { replace } = useSearch()
  return <Button onClick={() => replace({})}>Effacer tous les critères</Button>
}
