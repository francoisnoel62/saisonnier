"use client"

import { useQueryStates, type Options } from "nuqs"
import { createContext, use, useCallback, useMemo, useTransition } from "react"

import type { SearchCriteria } from "@/domain/search-criteria"
import {
  criteriaFromValues,
  searchParsers,
  searchUrlKeys,
  valuesFromCriteria,
  type FilterValues,
} from "@/server/search/search-params"

type SearchContextValue = {
  // État des filtres, lu dans l'URL et mis à jour sans attendre le serveur.
  values: FilterValues
  criteria: SearchCriteria
  // Change des filtres et revient à la première page.
  update: (patch: Partial<FilterValues>, options?: Options) => void
  // Remplace tous les critères : badge retiré, « Tout effacer ».
  replace: (criteria: SearchCriteria) => void
  // Vrai pendant que le serveur recalcule les résultats.
  isPending: boolean
}

const SearchContext = createContext<SearchContextValue | null>(null)

// Chaque changement de filtre réécrit l'URL et relance le rendu serveur de la page (shallow:
// false) dans une transition commune : liste et compteur se mettent à jour sans bouton « valider ».
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition()
  const [state, setValues] = useQueryStates(searchParsers, {
    urlKeys: searchUrlKeys,
    shallow: false,
    startTransition,
  })

  const update = useCallback(
    (patch: Partial<FilterValues>, options?: Options) =>
      void setValues({ ...patch, page: null }, options),
    [setValues],
  )
  const replace = useCallback(
    (criteria: SearchCriteria) =>
      void setValues({ ...valuesFromCriteria(criteria), page: null }),
    [setValues],
  )

  const value = useMemo(() => {
    // La page n'est pas un filtre : la pagination passe par des liens.
    const { page, ...values } = state
    void page
    return {
      values,
      criteria: criteriaFromValues(values),
      update,
      replace,
      isPending,
    }
  }, [state, update, replace, isPending])

  return <SearchContext value={value}>{children}</SearchContext>
}

export function useSearch() {
  const context = use(SearchContext)
  if (!context) throw new Error("useSearch exige un <SearchProvider>.")
  return context
}
