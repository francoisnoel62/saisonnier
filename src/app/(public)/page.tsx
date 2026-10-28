import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  HeartHandshakeIcon,
  HotelIcon,
  MountainSnowIcon,
  PlusIcon,
  Repeat2Icon,
  SproutIcon,
  SunIcon,
  TentTreeIcon,
  UtensilsIcon,
  WavesIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { AudienceFeatures } from "@/components/public/audience-features"
import { FeaturedOffers } from "@/components/public/featured-offers"
import { ProductScreenshot } from "@/components/public/product-screenshot"
import { productImages } from "@/components/public/product-images"
import { SeasonSearch } from "@/components/public/season-search"
import { Button } from "@/components/ui/button"
import { site } from "@/config/site"
import { signInPath } from "@/domain/redirects"
import { homePathFor } from "@/domain/roles"
import { getSession } from "@/lib/dal"
import { searchHref } from "@/server/search/search-params"
import styles from "@/components/public/landing.module.css"

export const metadata: Metadata = {
  title: {
    absolute: "ma saison · Votre prochaine saison. Et toutes celles d’après.",
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: site.name,
    url: "/",
    title: "ma saison · Bien plus qu’un job, la suite de votre histoire.",
    description: site.description,
    images: [
      {
        url: "/images/alpine-lake.jpg",
        width: 1500,
        height: 1125,
        alt: "Un nouvel horizon dans les Alpes avec ma saison",
      },
    ],
  },
}

const questions = [
  {
    title: "En quoi ma saison est plus qu’un site d’emploi ?",
    answer:
      "Une offre est un point de départ. Aujourd’hui, ma saison réunit la recherche, le dossier candidat, les offres sauvegardées et les candidatures déclarées. Les employeurs disposent d’un espace pour gérer leurs annonces. La suite du produit vise à relier les saisons : calendrier de carrière, vivier, réembauche et amélioration des recrutements.",
  },
  {
    title: "Est-ce gratuit pour les candidats ?",
    answer:
      "Oui. La création du compte, la recherche d’offres et la candidature sont gratuites. Vous pouvez commencer à explorer sans CV, puis compléter votre dossier avant de candidater.",
  },
  {
    title: "Comment ma saison accompagne les employeurs ?",
    answer:
      "Dès aujourd’hui, les employeurs peuvent créer leur espace entreprise et gérer leurs annonces. Le rattachement à l’entreprise est vérifié avant publication. Notre feuille de route va plus loin : anticiper les besoins, entretenir un vivier, proposer un retour aux anciens saisonniers et tirer les enseignements de chaque saison.",
  },
  {
    title: "Le calendrier et le vivier sont-ils déjà disponibles ?",
    answer:
      "Pas encore. Les captures montrent l’application actuelle avec des données de démonstration. Le calendrier de carrière, le vivier employeur, les campagnes de réembauche et les bilans sont des évolutions prévues, signalées « À venir ». Aucune date de lancement n’est annoncée à ce stade.",
  },
  {
    title: "Puis-je trouver une saison avec un logement ?",
    answer:
      "Oui. Le filtre « Avec logement » permet de sélectionner les offres qui mentionnent un logement proposé. Consultez l’annonce et échangez avec l’employeur pour vérifier sa disponibilité, son coût éventuel et ses conditions.",
  },
]

export default async function HomePage() {
  const session = await getSession()
  const candidateHref = session
    ? homePathFor(session.user.role)
    : "/inscription/candidat"
  const employerHref = session
    ? homePathFor(session.user.role)
    : "/inscription/employeur"
  const browse = (path: string) => (session ? path : signInPath(path))

  return (
    <div data-landing className={styles.landing}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <a href="#notre-vision" className={styles.heroEyebrow}>
          <span /> LA VIE SAISONNIÈRE, AVEC UNE SUITE{" "}
          <ChevronRightIcon aria-hidden />
        </a>
        <h1 id="hero-title">
          Votre prochaine saison.
          <br />
          <em>Et toutes celles d’après.</em>
        </h1>
        <p className={styles.heroDescription}>
          Le logiciel pour construire votre carrière saisonnière.
          <br className="hidden sm:block" /> Et des équipes qui ont envie de
          revenir.
        </p>
        <a href="#saisonniers" className={styles.heroDiscover}>
          Deux côtés. Une même envie d’avancer. <ArrowDownIcon aria-hidden />
        </a>
      </section>

      <section
        className={styles.audiences}
        aria-label="Deux espaces, une même plateforme"
      >
        <article id="saisonniers" className={styles.audience}>
          <div className={styles.audienceHeading}>
            <div>
              <span className={styles.audienceLabel}>
                <SunIcon aria-hidden /> CÔTÉ SAISONNIERS
              </span>
              <h2>
                Une saison, un job.
                <br />
                Et un vrai parcours.
              </h2>
            </div>
            <Button asChild className="h-11 shrink-0 rounded-full px-5">
              <Link href={candidateHref}>
                {session ? "Mon espace" : "Créer mon espace"}
                <ArrowUpRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <p className={styles.audienceDescription}>
            Trouvez votre prochaine opportunité, gardez le fil de vos
            candidatures et construisez la suite de votre carrière.
          </p>
          <ProductScreenshot
            src={productImages.candidateTracking}
            title="L’espace saisonnier : mes offres et mes candidatures"
            eager
          />
          <div className={styles.previewCaption}>
            <span>Votre espace saisonnier, aujourd’hui.</span>
            <a href="#le-logiciel">
              Découvrir <ArrowUpRightIcon aria-hidden />
            </a>
          </div>
        </article>
        <article id="employeurs" className={styles.audience}>
          <div className={styles.audienceHeading}>
            <div>
              <span className={styles.audienceLabel}>
                <SproutIcon aria-hidden /> CÔTÉ EMPLOYEURS
              </span>
              <h2>
                Une équipe cette saison.
                <br />
                Un lien pour les suivantes.
              </h2>
            </div>
            <Button asChild className="h-11 shrink-0 rounded-full px-5">
              <Link href={employerHref}>
                Préparer ma saison
                <ArrowUpRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <p className={styles.audienceDescription}>
            Recrutez aujourd’hui. Construisons les outils pour fidéliser vos
            saisonniers, les réembaucher et anticiper demain.
          </p>
          <ProductScreenshot
            src={productImages.employerOffers}
            title="L’espace employeur : mes annonces et mes recrutements"
            tone="peach"
            eager
          />
          <div className={styles.previewCaption}>
            <span>Votre espace employeur, aujourd’hui.</span>
            <a href="#le-logiciel">
              Découvrir <ArrowUpRightIcon aria-hidden />
            </a>
          </div>
        </article>
        <p className={styles.captureNote}>
          Captures réelles de l’application · données de démonstration.
        </p>
      </section>

      <section className={styles.sectors} aria-label="Les secteurs accompagnés">
        <p>POUR CELLES ET CEUX QUI FONT VIVRE LES SAISONS</p>
        <div>
          {[
            { icon: HotelIcon, name: "Hôtellerie" },
            { icon: UtensilsIcon, name: "Restauration" },
            { icon: TentTreeIcon, name: "Campings" },
            { icon: MountainSnowIcon, name: "Montagne" },
            { icon: WavesIcon, name: "Tourisme & loisirs" },
          ].map(({ icon: Icon, name }) => (
            <span key={name}>
              <Icon aria-hidden />
              {name}
            </span>
          ))}
        </div>
      </section>

      <AudienceFeatures
        candidateHref={candidateHref}
        employerHref={employerHref}
      />

      <section
        className={styles.vision}
        id="notre-vision"
        aria-labelledby="vision-title"
      >
        <div className={styles.visionHeading}>
          <span className={styles.eyebrow}>NOTRE VISION</span>
          <h2 id="vision-title">
            Ne plus repartir de zéro.
            <br />
            <em>Grandir à chaque saison.</em>
          </h2>
          <p>
            Une carrière ne tient pas dans une annonce.
            <br />
            Une bonne équipe ne se construit pas dans l’urgence.
          </p>
        </div>
        <div className={styles.visionGrid}>
          <div className={styles.visionPhoto}>
            <Image
              src="/images/alpine-lake.jpg"
              alt="Un lac d’altitude et les sommets des Alpes, un des horizons de la vie saisonnière"
              fill
              sizes="(max-width: 800px) 90vw, 600px"
            />
            <div>
              <span>LE MÊME ÉLAN.</span>
              <p>De nouveaux horizons.</p>
            </div>
          </div>
          <div className={styles.visionCopy}>
            <span className={styles.roadmapTag}>LE CAP POUR LA SUITE</span>
            <h3>
              La prochaine saison
              <br />
              se prépare maintenant.
            </h3>
            <p>
              Nous construisons ma saison pour que chaque expérience compte.
              Pour les saisonniers qui veulent avancer. Pour les employeurs qui
              veulent retrouver leurs talents et faire progresser leurs équipes.
            </p>
            <ol className={styles.visionSteps}>
              <li>
                <span>
                  <CalendarDaysIcon aria-hidden />
                </span>
                <div>
                  <h4>Anticiper les besoins</h4>
                  <p>
                    Voir les postes à pourvoir et les disponibilités avant que
                    la saison ne commence.
                  </p>
                </div>
              </li>
              <li>
                <span>
                  <HeartHandshakeIcon aria-hidden />
                </span>
                <div>
                  <h4>Entretenir le lien</h4>
                  <p>
                    Connaître les envies de retour et préparer la réembauche des
                    saisonniers.
                  </p>
                </div>
              </li>
              <li>
                <span>
                  <Repeat2Icon aria-hidden />
                </span>
                <div>
                  <h4>Apprendre de chaque saison</h4>
                  <p>
                    Transformer les retours d’expérience en améliorations
                    concrètes pour la suivante.
                  </p>
                </div>
              </li>
            </ol>
            <Link href="/contact" className={styles.textLink}>
              Construisons ces outils avec vous <ArrowUpRightIcon aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.explore} aria-labelledby="explore-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>
            ET SI ON COMMENÇAIT PAR LA PROCHAINE ?
          </span>
          <h2 id="explore-title">
            Votre prochain chapitre
            <br />
            <em>se trouve peut-être ici.</em>
          </h2>
        </div>
        <SeasonSearch signedIn={!!session} />
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs text-[var(--ms-muted)]">
          <Link
            className={styles.destinationLink}
            href={browse(
              searchHref({
                departments: ["04", "05", "09", "38", "65", "73", "74"],
              }),
            )}
            aria-label="Explorer les départements de montagne"
          >
            <MountainSnowIcon aria-hidden /> À la montagne{" "}
            <ArrowUpRightIcon aria-hidden />
          </Link>
          <Link
            className={styles.destinationLink}
            href={browse(
              searchHref({
                departments: [
                  "06",
                  "17",
                  "29",
                  "33",
                  "40",
                  "56",
                  "64",
                  "83",
                  "85",
                ],
              }),
            )}
          >
            <WavesIcon aria-hidden /> Au bord de la mer{" "}
            <ArrowUpRightIcon aria-hidden />
          </Link>
        </div>
      </section>

      <FeaturedOffers catalogueHref={browse("/offres")} />

      <section
        id="questions"
        className={styles.faq}
        aria-labelledby="faq-title"
      >
        <div>
          <span className={styles.eyebrow}>TOUT SIMPLEMENT</span>
          <h2 id="faq-title">
            Les bonnes
            <br />
            <em>questions.</em>
          </h2>
          <p className="mt-6 text-sm leading-7 text-[var(--ms-muted)]">
            Une autre question ?<br />
            <Link href="/contact" className={styles.textLink}>
              Parlons-en <ArrowUpRightIcon aria-hidden />
            </Link>
          </p>
        </div>
        <div className={styles.faqList}>
          {questions.map(({ title, answer }) => (
            <details key={title}>
              <summary>
                {title}
                <PlusIcon aria-hidden />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-title">
        <SunIcon aria-hidden className={styles.finalSun} />
        <span className={styles.eyebrow}>
          LE MEILLEUR MOMENT POUR PRÉPARER LA SUITE
        </span>
        <h2 id="final-title">C’est votre saison.</h2>
        <p>Faisons-en le début de quelque chose qui dure.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="h-12 rounded-full px-6">
            <Link href={candidateHref}>
              Je suis saisonnier <ArrowUpRightIcon aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-full border-[var(--ms-ink)] bg-transparent px-6"
          >
            <Link href={employerHref}>
              Je suis employeur <ArrowUpRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
