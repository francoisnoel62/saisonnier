import { SearchXIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DossierBanner } from "@/components/dossier/dossier-banner"
import { OfferCard } from "@/components/offers/offer-card"
import { OfferContent } from "@/components/offers/offer-content"
import {
  OfferResultsLayout,
  OfferViewSelector,
} from "@/components/offers/offer-browser"
import { offerView, withOfferView } from "@/domain/offer-view"
import styles from "@/components/offers/offers.module.css"
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
  const query = await searchParams
  const { criteria, page } = loadSearch(query)
  const view = offerView(query.vue)
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
  const selected = items.find((item) => item.id === query.offre)
  const detailId = selected?.id ?? items[0]?.id
  const returnHref = withOfferView(searchHref(criteria, page), view)

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
        <div className={styles.modeBar}>
          <ResultsHeader total={total} />
          <OfferViewSelector view={view} />
        </div>
        <ResultsRegion>
          {items.length > 0 ? (
            <OfferResultsLayout
              view={view}
              selectedId={selected?.id}
              detailId={detailId}
              detail={
                view === "immersion" && detailId ? (
                  <OfferContent
                    key={detailId}
                    id={detailId}
                    embedded
                    returnHref={returnHref}
                  />
                ) : undefined
              }
              list={
                <ul className={styles.listing} data-view={view}>
                  {items.map((offer) => (
                    <li
                      key={offer.id}
                      className={
                        view === "immersion" && offer.id === detailId
                          ? styles.selected
                          : undefined
                      }
                    >
                      <OfferCard
                        offer={offer}
                        layout={
                          view === "comparateur"
                            ? "row"
                            : view === "immersion"
                              ? "compact"
                              : "card"
                        }
                        selected={view === "immersion" && offer.id === detailId}
                        href={
                          view === "immersion"
                            ? withOfferView(returnHref, view, offer.id)
                            : `/offres/${offer.id}?${new URLSearchParams({ retour: returnHref })}`
                        }
                        saved={
                          tracking
                            ? !!tracking.get(offer.id)?.savedAt
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              }
            />
          ) : total > 0 ? (
            // Page au-delà de la dernière (lien ancien, offres retirées entre-temps).
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Cette page n&rsquo;existe plus</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href={withOfferView(searchHref(criteria), view)}>
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
            view={view}
          />
        </ResultsRegion>
      </div>
    </SearchProvider>
  )
}
