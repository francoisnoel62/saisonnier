import { BanknoteIcon, CalendarDaysIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { contractPeriod } from "@/domain/offer-display"
import { formatSalary } from "@/domain/salary"
import { newnessLabel } from "@/domain/offer-labels"
import { isToConfirm } from "@/domain/field-certainty"
import { otherPlacesLabel } from "@/domain/offer-places"
import type { OfferListItem } from "@/server/search/search-offers"
import { ExternalApplicationBadge } from "./external-application"
import { SaveOfferButton } from "./tracking-buttons"
import {
  OfferAmenity,
  OfferArtwork,
  OfferCategory,
  OfferSeason,
  OfferTrust,
} from "./offer-visuals"
import styles from "./offers.module.css"

// Le lien de lecture reste indépendant des actions de sauvegarde et de suivi.
export function OfferCard({
  offer,
  saved,
  expired = false,
  footer,
  layout = "card",
  href,
  selected = false,
}: {
  offer: OfferListItem
  saved?: boolean
  expired?: boolean
  footer?: React.ReactNode
  layout?: "card" | "row" | "compact"
  href?: string
  selected?: boolean
}) {
  return (
    <Card className={styles.card} data-layout={layout}>
      {layout === "card" && (
        <div className={styles.cover}>
          <OfferArtwork family={offer.occupationFamily} />
          <span className={styles.coverSeason}>
            <OfferSeason season={offer.season} />
          </span>
        </div>
      )}
      {saved !== undefined && (
        <SaveOfferButton
          offerId={offer.id}
          title={offer.title}
          saved={saved}
          className={styles.save}
        />
      )}
      <div className={styles.identity}>
        <OfferCategory family={offer.occupationFamily} />
        <h3 className={styles.title}>
          <Link
            href={href ?? `/offres/${offer.id}`}
            aria-current={selected ? "true" : undefined}
            scroll={layout === "compact" ? false : undefined}
          >
            {offer.title}
          </Link>
        </h3>
        <p className={styles.company}>{offer.companyName}</p>
        {expired && (
          <Badge variant="destructive" className="mt-2">
            Offre expirée
          </Badge>
        )}
      </div>
      <div className={styles.cardFacts}>
        <p className={styles.location}>
          <MapPinIcon aria-hidden />
          <span>
            {offer.communeName} · {offer.department.name} (
            {offer.department.code}){otherPlacesLabel(offer.placesCount - 1)}
          </span>
        </p>
        {layout !== "card" && <OfferSeason season={offer.season} />}
        <p className={styles.period}>
          <CalendarDaysIcon aria-hidden />
          <span>{contractPeriod(offer)}</span>
        </p>
        <p className={styles.salary} data-unknown={!offer.salary}>
          <BanknoteIcon aria-hidden />
          <span>
            {offer.salary
              ? formatSalary(offer.salary)
              : isToConfirm(offer, "salary")
                ? "Salaire à confirmer"
                : "Salaire non précisé"}
          </span>
        </p>
      </div>
      <dl className={styles.perks}>
        <OfferAmenity
          label="Logement"
          kind="housing"
          value={offer.housing}
          toConfirm={isToConfirm(offer, "housing")}
        />
        <OfferAmenity
          label="Repas"
          kind="meals"
          value={offer.meals}
          toConfirm={isToConfirm(offer, "meals")}
        />
      </dl>
      <div className={styles.cardFoot}>
        <OfferTrust provenance={offer.provenance} />
        {offer.externalApplication && <ExternalApplicationBadge />}
        {offer.newness && <p>{newnessLabel(offer.newness)}</p>}
      </div>
      {footer && (
        <div className="relative z-10 flex flex-wrap gap-2 px-5 pb-4">
          {footer}
        </div>
      )}
    </Card>
  )
}
