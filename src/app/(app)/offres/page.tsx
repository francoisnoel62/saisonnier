import { SearchXIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DossierBanner } from "@/components/dossier/dossier-banner"
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
import { dossierStatus } from "@/domain/candidate-dossier"
import { requireRole } from "@/lib/dal"
import { getDossier } from "@/server/candidates/dossier"
import { getTracking } from "@/server/candidates/tracking"
import { getSearchReferentials } from "@/server/search/referentials"
import { loadSearch, searchHref } from "@/server/search/search-params"
import { DEFAULT_PAGE_SIZE, searchOffers } from "@/server/search/search-offers"

export const metadata: Metadata = { title: "Rechercher des offres" }

// Recherche des offres (§4) : l'URL porte les critères ; chaque filtre modifié relance ce rendu.
export default async function OffersPage({
  searchParams,
}: PageProps<"/offres">) {
  const { user } = await requireRole("candidate", "admin")
  const { criteria, page } = loadSearch(await searchParams)
  const [{ items, total }, referentials, dossier] = await Promise.all([
    searchOffers(criteria, { page }),
    getSearchReferentials(),
    // Seul un candidat a un dossier ; l'admin consulte le catalogue.
    user.role === "candidate" ? getDossier(user.id) : null,
  ])
  // Offres déjà sauvegardées par le candidat, pour l'état de leur bouton.
  const tracking =
    user.role === "candidate"
      ? await getTracking(
          user.id,
          items.map((offer) => offer.id),
        )
      : null
  const pageCount = Math.ceil(total / DEFAULT_PAGE_SIZE)
  const hasCriteria = Object.keys(criteria).length > 0

  return (
    <SearchProvider>
      <div className="flex flex-col gap-4">
        {/* Un dossier incomplet n'empêche pas de rechercher (§9). */}
        {dossier && (
          <DossierBanner
            missing={
              dossierStatus({
                name: dossier.name,
                phone: dossier.phone,
                cvPathname: dossier.cv?.pathname,
              }).missing
            }
          />
        )}
        <SearchFilters referentials={referentials} total={total} />
        <ActiveFilters referentials={referentials} />
        <ResultsHeader total={total} />
        <ResultsRegion>
          {items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((offer) => (
                <li key={offer.id}>
                  <OfferCard
                    offer={offer}
                    saved={
                      tracking ? !!tracking.get(offer.id)?.savedAt : undefined
                    }
                  />
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
