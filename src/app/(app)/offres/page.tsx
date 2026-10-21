import { SearchXIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { OfferCard } from "@/components/offers/offer-card"
import {
  ActiveFilters,
  ClearFiltersButton,
} from "@/components/search/active-filters"
import { ResultsHeader, ResultsRegion } from "@/components/search/results"
import { ResultsPagination } from "@/components/search/results-pagination"
import { SearchFilters } from "@/components/search/search-filters"
import { SearchProvider } from "@/components/search/search-provider"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireRole } from "@/lib/dal"
import { getSearchReferentials } from "@/server/search/referentials"
import { loadSearch, searchHref } from "@/server/search/search-params"
import { DEFAULT_PAGE_SIZE, searchOffers } from "@/server/search/search-offers"

export const metadata: Metadata = { title: "Rechercher des offres" }

// Recherche des offres (§4) : l'URL porte les critères ; chaque filtre modifié relance ce rendu.
export default async function OffersPage({
  searchParams,
}: PageProps<"/offres">) {
  await requireRole("candidate", "admin")
  const { criteria, page } = loadSearch(await searchParams)
  const [{ items, total }, referentials] = await Promise.all([
    searchOffers(criteria, { page }),
    getSearchReferentials(),
  ])
  const pageCount = Math.ceil(total / DEFAULT_PAGE_SIZE)
  const hasCriteria = Object.keys(criteria).length > 0

  return (
    <SearchProvider>
      <div className="flex flex-col gap-4">
        <SearchFilters referentials={referentials} total={total} />
        <ActiveFilters referentials={referentials} />
        <ResultsHeader total={total} />
        <ResultsRegion>
          {items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} />
                </li>
              ))}
            </ul>
          ) : total > 0 ? (
            // Page au-delà de la dernière (lien ancien, offres retirées entre-temps).
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Cette page n&rsquo;existe plus</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href={searchHref(criteria)}>
                    Revenir à la première page
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Aucune offre ne correspond</EmptyTitle>
                <EmptyDescription>
                  {hasCriteria
                    ? "Retirez un critère pour élargir votre recherche."
                    : "Aucune offre n'est publiée pour le moment. Revenez bientôt."}
                </EmptyDescription>
              </EmptyHeader>
              {hasCriteria && (
                <EmptyContent>
                  <ClearFiltersButton />
                </EmptyContent>
              )}
            </Empty>
          )}
          <ResultsPagination
            criteria={criteria}
            page={page}
            pageCount={pageCount}
          />
        </ResultsRegion>
      </div>
    </SearchProvider>
  )
}
