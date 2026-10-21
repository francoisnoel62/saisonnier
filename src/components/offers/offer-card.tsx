import {
  BanknoteIcon,
  BedDoubleIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UtensilsIcon,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  contractPeriod,
  originLabels,
  seasonLabels,
} from "@/domain/offer-display"
import { formatSalary } from "@/domain/salary"
import type { OfferListItem } from "@/server/search/search-offers"

import { InfoValue } from "./info-value"

// Carte d'une offre dans les résultats. Logement et repas restent affichés même inconnus ; le
// nom de l'entreprise est déjà son nom public (publicCompanyName).
export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Card className="relative h-full gap-3 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <CardHeader className="gap-1.5">
        <Badge variant="outline" className="mb-1">
          {originLabels[offer.origin]}
        </Badge>
        <CardTitle>
          <h3>
            <Link
              href={`/offres/${offer.id}`}
              className="after:absolute after:inset-0 hover:underline focus-visible:outline-none"
            >
              {offer.title}
            </Link>
          </h3>
        </CardTitle>
        <CardDescription>{offer.companyName}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="flex items-start gap-2">
          <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {`${offer.communeName} · ${offer.department.name} (${offer.department.code})`}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarDaysIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {seasonLabels[offer.season]} · {contractPeriod(offer)}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <BanknoteIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {offer.salary ? (
            <span>{formatSalary(offer.salary)}</span>
          ) : (
            <span className="text-muted-foreground">Salaire non précisé</span>
          )}
        </p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <BedDoubleIcon className="size-4 shrink-0" aria-hidden />
            <dt>Logement :</dt>
            <dd>
              <InfoValue value={offer.housing} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <UtensilsIcon className="size-4 shrink-0" aria-hidden />
            <dt>Repas :</dt>
            <dd>
              <InfoValue value={offer.meals} />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
