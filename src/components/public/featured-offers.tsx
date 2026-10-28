import { ArrowUpRightIcon, CalendarDaysIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import {
  OfferArtwork,
  OfferCategory,
  OfferSeason,
} from "@/components/offers/offer-visuals"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Season } from "@/domain/offer"
import styles from "./featured-offers.module.css"

// Maquette éditoriale uniquement : exemples issus du catalogue fictif local.
// Aucun accès à la base ni classement automatique. Voir docs/landing-featured-offers.md.
const examples = [
  {
    title: "Responsable d’hébergement",
    company: "Hôtel du Grand Sérac",
    family: "Encadrement",
    place: "Briançon · Hautes-Alpes",
    season: "winter",
    period: "Saison d’hiver",
    min: 2600,
  },
  {
    title: "Chef / cheffe de partie",
    company: "Entreprise confidentielle",
    family: "Cuisine",
    place: "Bormes-les-Mimosas · Var",
    season: "summer",
    period: "Saison d’été",
    min: 2300,
  },
  {
    title: "Chef / cheffe de rang",
    company: "Paillote Le Galet Bleu",
    family: "Salle & bar",
    place: "Saint-Tropez · Var",
    season: "summer",
    period: "Saison d’été",
    min: 2200,
  },
  {
    title: "Chef de partie",
    company: "Hôtel du Grand Sérac",
    family: "Cuisine",
    place: "Chamonix-Mont-Blanc · Haute-Savoie",
    season: "winter",
    period: "Saison d’hiver",
    min: 2100,
    max: 2400,
  },
] satisfies {
  title: string
  company: string
  family: string
  place: string
  season: Season
  period: string
  min: number
  max?: number
}[]

const euros = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

export function FeaturedOffers({ catalogueHref }: { catalogueHref: string }) {
  return (
    <section
      id="annonces-a-la-une"
      className={styles.section}
      aria-labelledby="featured-title"
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>DE BELLES SAISONS EN PERSPECTIVE</p>
          <h2 id="featured-title">
            Et si la suite
            <br />
            <em>commençait ici ?</em>
          </h2>
          <p className={styles.intro}>
            Un métier, un lieu, de nouvelles perspectives. Projetez-vous.
          </p>
        </div>
        <Badge variant="outline" className={styles.demo}>
          Aperçu · annonces de démonstration
        </Badge>
      </header>
      <ul className={styles.grid}>
        {examples.map((offer) => (
          <li key={`${offer.title}-${offer.place}`}>
            <Card className={styles.card}>
              <div className={styles.cover}>
                <OfferArtwork family={offer.family} />
                <span className={styles.season}>
                  <OfferSeason season={offer.season} />
                </span>
              </div>
              <div className={styles.body}>
                <OfferCategory family={offer.family} />
                <h3>{offer.title}</h3>
                <p className={styles.company}>{offer.company}</p>
                <p className={styles.fact}>
                  <MapPinIcon aria-hidden />
                  <span>{offer.place}</span>
                </p>
                <p className={styles.fact}>
                  <CalendarDaysIcon aria-hidden />
                  <span>{offer.period}</span>
                </p>
                <div className={styles.pay}>
                  <p>
                    <strong>
                      {euros.format(offer.min)}
                      {offer.max ? ` – ${euros.format(offer.max)}` : ""} €
                    </strong>
                    <span>net / mois avant impôt</span>
                  </p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <div className={styles.bottom}>
        <p>
          Votre prochaine saison mérite
          <br className={styles.desktopBreak} /> de belles perspectives.
        </p>
        <Button asChild className="h-12 rounded-full px-6">
          <Link href={catalogueHref}>
            Explorer les offres <ArrowUpRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}
