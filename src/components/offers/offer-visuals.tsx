import {
  BanknoteIcon,
  BedDoubleIcon,
  CalendarDaysIcon,
  CheckIcon,
  CircleHelpIcon,
  ChefHatIcon,
  ClockIcon,
  EyeOffIcon,
  Flower2Icon,
  GlobeIcon,
  HotelIcon,
  LeafIcon,
  LifeBuoyIcon,
  MapPinIcon,
  MountainSnowIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SnowflakeIcon,
  SunIcon,
  TentTreeIcon,
  UsersIcon,
  UtensilsIcon,
  WineIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  employerOfferStateLabels,
  type EmployerOfferState,
} from "@/domain/employer-offer"
import { isToConfirm } from "@/domain/field-certainty"
import { contractPeriod, seasonLabels } from "@/domain/offer-display"
import { provenanceLabels, type Provenance } from "@/domain/offer-labels"
import { displayedSalary, formatSalary } from "@/domain/salary"
import type { Season } from "@/domain/offer"
import type { TriState } from "@/domain/tri-state"
import { cn } from "@/lib/utils"
import type { OfferDetailsData } from "./offer-details"
import { ExternalApplicationBadge } from "./external-application"
import { InfoValue } from "./info-value"
import styles from "./offers.module.css"

// Le référentiel métier est la source de la famille, jamais le titre de l'annonce.
const families = {
  "Réception & hébergement": { tone: "lavender", Icon: HotelIcon },
  "Étages & entretien": { tone: "lavender", Icon: HotelIcon },
  "Salle & bar": { tone: "terra", Icon: WineIcon },
  Cuisine: { tone: "terra", Icon: ChefHatIcon },
  "Animation & enfance": { tone: "ochre", Icon: TentTreeIcon },
  "Sport & loisirs": { tone: "glacier", Icon: LifeBuoyIcon },
  "Domaine skiable": { tone: "glacier", Icon: MountainSnowIcon },
  "Commerce & location": { tone: "glacier", Icon: ShoppingBagIcon },
  "Bien-être": { tone: "sage", Icon: Flower2Icon },
  "Accueil touristique": { tone: "ochre", Icon: TentTreeIcon },
  "Technique & transport": { tone: "sage", Icon: WrenchIcon },
  Encadrement: { tone: "lavender", Icon: UsersIcon },
  Agriculture: { tone: "sage", Icon: LeafIcon },
} as const

export function familyAppearance(family?: string | null) {
  return family && Object.hasOwn(families, family)
    ? families[family as keyof typeof families]
    : { tone: "sage", Icon: Flower2Icon }
}
export function OfferCategory({ family }: { family?: string | null }) {
  const { tone, Icon } = familyAppearance(family)
  return (
    <Badge
      variant="secondary"
      className={cn(styles.palette, styles.category)}
      data-tone={tone}
    >
      <Icon aria-hidden />
      {family || "Catégorie non précisée"}
    </Badge>
  )
}
export function OfferSeason({ season }: { season: Season | null }) {
  if (!season) return null
  const Icon = season === "winter" ? SnowflakeIcon : SunIcon
  return (
    <span className={styles.season}>
      <Icon aria-hidden />
      {seasonLabels[season]}
    </span>
  )
}
export function OfferArtwork({
  family,
  large = false,
}: {
  family?: string | null
  large?: boolean
}) {
  const { tone, Icon } = familyAppearance(family)
  return (
    <div
      className={cn(
        styles.palette,
        styles.artwork,
        large && styles.artworkLarge,
      )}
      data-tone={tone}
      aria-hidden="true"
    >
      <span className={styles.orbit} />
      <span className={styles.hill} />
      <span className={styles.hillFront} />
      <Icon strokeWidth={1} className={styles.artIcon} />
    </div>
  )
}
export function OfferTrust({ provenance }: { provenance: Provenance }) {
  const verified =
    provenance === "human_verified" || provenance === "verified_recruiter"
  const Icon = verified ? ShieldCheckIcon : GlobeIcon
  return (
    <Badge variant="outline" className={styles.trust} data-verified={verified}>
      <Icon aria-hidden />
      {provenanceLabels[provenance]}
    </Badge>
  )
}
export function OfferStatus({ state }: { state: EmployerOfferState }) {
  const Icon = {
    online: CheckIcon,
    pending_review: ClockIcon,
    offline: EyeOffIcon,
    expired: ClockIcon,
    rejected: XIcon,
  }[state]
  return (
    <Badge variant="outline" className={styles.status} data-state={state}>
      <Icon aria-hidden />
      {employerOfferStateLabels[state]}
    </Badge>
  )
}
export function OfferAmenity({
  label,
  kind,
  value,
  toConfirm,
}: {
  label: string
  kind: "housing" | "meals"
  value: TriState
  toConfirm: boolean
}) {
  const Icon = kind === "housing" ? BedDoubleIcon : UtensilsIcon
  return (
    <div
      className={styles.amenity}
      data-provided={value === "yes" && !toConfirm}
    >
      <dt>
        <Icon aria-hidden />
        {label}
      </dt>
      <dd>
        <InfoValue value={value} toConfirm={toConfirm} />
      </dd>
    </div>
  )
}
export function OfferHero({
  title,
  companyName,
  details,
  action,
}: {
  title: string
  companyName: string
  details: OfferDetailsData
  action?: React.ReactNode
}) {
  return (
    <header className={styles.hero}>
      <OfferArtwork family={details.occupationFamily} large />
      <div className={styles.heroBody}>
        <div className={styles.tags}>
          <OfferCategory family={details.occupationFamily} />
          <OfferSeason season={details.season} />
          {details.externalApplication && <ExternalApplicationBadge />}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={styles.heroTitle}>
              {title || "Intitulé à préciser"}
            </h2>
            <p className={styles.heroCompany}>{companyName}</p>
          </div>
          {action}
        </div>
        <p className={styles.location}>
          <MapPinIcon aria-hidden />
          {details.communeName || "Commune non précisée"}
          {details.department &&
            ` · ${details.department.name} (${details.department.code})`}
          {details.places.length > 1 &&
            ` · + ${details.places.length - 1} lieu(x)`}
        </p>
        <OfferTrust provenance={details.provenance} />
      </div>
    </header>
  )
}
export function OfferSummary({ offer }: { offer: OfferDetailsData }) {
  const salary = displayedSalary(offer)
  return (
    <dl className={styles.summary} aria-label="L’essentiel de l’offre">
      <div className={styles.summaryFact}>
        <dt>
          <CalendarDaysIcon aria-hidden />
          Votre saison
        </dt>
        <dd>{contractPeriod(offer)}</dd>
      </div>
      <div className={styles.summaryFact}>
        <dt>
          <BanknoteIcon aria-hidden />
          Rémunération
        </dt>
        <dd>
          {salary
            ? formatSalary(salary)
            : isToConfirm(offer, "salary")
              ? "Salaire à confirmer"
              : "Salaire non précisé"}
        </dd>
      </div>
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
  )
}
export function OfferMissingInfo({ offer }: { offer: OfferDetailsData }) {
  const missing = [
    !displayedSalary(offer) && "Salaire",
    offer.housing === "unknown" && "Logement",
    offer.meals === "unknown" && "Repas",
  ].filter(Boolean)
  if (!missing.length) return null
  return (
    <p className={styles.missing}>
      <CircleHelpIcon aria-hidden />
      {missing.join(" · ")} à préciser
    </p>
  )
}
