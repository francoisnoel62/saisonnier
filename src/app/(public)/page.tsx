import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  HandshakeIcon,
  MapPinIcon,
  MountainSnowIcon,
  PlusIcon,
  ShieldCheckIcon,
  SunSnowIcon,
  UtensilsIcon,
  WavesIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { SeasonSearch } from "@/components/public/season-search"
import { Button } from "@/components/ui/button"
import { site } from "@/config/site"
import { signInPath } from "@/domain/redirects"
import { homePathFor } from "@/domain/roles"
import { getSession } from "@/lib/dal"
import { searchHref } from "@/server/search/search-params"

import styles from "@/components/public/public.module.css"

export const metadata: Metadata = {
  title: { absolute: `${site.name} · Un job. Un lieu. Une saison à vivre.` },
  description:
    "Trouvez votre prochain emploi saisonnier en France. Hôtellerie, restauration, tourisme, animation : une destination, un job et de vraies rencontres. 0 % IA, 100 % humain.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: site.name,
    title: `${site.name} · Une saison à vivre`,
    description:
      "Un job, une destination, une aventure humaine. Votre prochaine saison commence ici.",
    url: "/",
    images: [
      {
        url: "/images/alpine-lake.jpg",
        width: 1500,
        height: 1125,
        alt: "Un lac face aux sommets des Alpes",
      },
    ],
  },
}

const destinations = [
  {
    title: "L’air du large.",
    subtitle: "Les pieds dans le sable, la tête ailleurs.",
    image: "/images/coast.jpg",
    alt: "Une plage de sable ouverte sur la mer",
    icon: WavesIcon,
    label: "CÔTÉ MER",
    criteria: {
      departments: [
        "06",
        "13",
        "17",
        "22",
        "29",
        "33",
        "34",
        "40",
        "44",
        "56",
        "64",
        "66",
        "83",
        "85",
        "2A",
        "2B",
      ],
    },
    searchLabel: "Explorer les départements du littoral",
  },
  {
    title: "La vie au sommet.",
    subtitle: "Prendre de la hauteur. Pour de vrai.",
    image: "/images/alpine-lake.jpg",
    alt: "Les sommets de Chamonix se reflètent dans un lac",
    icon: MountainSnowIcon,
    label: "CÔTÉ MONTAGNE",
    criteria: { departments: ["04", "05", "09", "38", "65", "73", "74"] },
    searchLabel: "Explorer les départements de montagne",
  },
  {
    title: "Le goût des autres.",
    subtitle: "De belles tables. De belles rencontres.",
    image: "/images/restaurant.jpg",
    alt: "Un plat servi à table dans un restaurant chaleureux",
    icon: UtensilsIcon,
    label: "CÔTÉ RENCONTRES",
    criteria: { occupations: ["serveur", "cuisinier", "receptionniste"] },
    searchLabel: "Explorer les métiers de l’accueil et de la restauration",
  },
]

const questions = [
  {
    title: "Est-ce gratuit pour les candidats ?",
    answer:
      "Oui. La création du compte, la recherche d’offres et la candidature sont gratuites. Créez votre compte pour consulter les annonces, puis complétez votre dossier lorsque vous êtes prêt à candidater.",
  },
  {
    title: "Puis-je trouver un emploi avec un logement ?",
    answer:
      "Oui, le filtre « Avec logement » sélectionne les offres qui mentionnent un logement proposé. Consultez chaque annonce et échangez avec l’employeur pour en connaître les conditions : disponibilité, coût éventuel et type de logement.",
  },
  {
    title: "Je n’ai jamais fait de saison. Je peux me lancer ?",
    answer:
      "Bien sûr. Le filtre « Débutants acceptés » vous permet de trouver les employeurs ouverts à une première expérience. Aucun CV n’est nécessaire pour commencer vos recherches ; votre dossier vous sera demandé avant votre première candidature.",
  },
  {
    title: "Comment se passe la candidature ?",
    answer:
      "Vous repérez une offre, complétez votre dossier, puis contactez l’employeur selon les modalités indiquées dans l’annonce. Vous choisissez vous-même ce que vous envoyez et à qui : aucune candidature n’est transmise automatiquement.",
  },
]

export default async function HomePage() {
  const session = await getSession()
  const browse = (path: string) => (session ? path : signInPath(path))
  const accountHref = session
    ? homePathFor(session.user.role)
    : "/inscription/candidat"
  const employerHref =
    session?.user.role === "employer" ? "/employeur" : "/inscription/employeur"

  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.liveDot} /> LE DÉBUT DE VOTRE PROCHAINE
            HISTOIRE
          </p>
          <h1 id="hero-title">
            Un job. Un lieu.
            <br />
            <em>
              Une saison
              <br /> à vivre.
            </em>
          </h1>
          <p className={styles.heroDescription}>
            Il y a des jobs qui changent le quotidien.
            <br />
            Et des saisons qui changent tout.
          </p>
          <p className={styles.heroDetail}>
            Mer, montagne ou grand air : trouvez votre emploi saisonnier et les
            rencontres qui vont avec.
          </p>
          <a href="#recherche" className={styles.heroTextLink}>
            Votre prochain départ commence ici <ArrowDownIcon aria-hidden />
          </a>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroPhoto}>
            <Image
              src="/images/alpine-lake.jpg"
              alt="Les montagnes de Chamonix et leur reflet dans un lac d’altitude"
              fill
              sizes="(max-width: 700px) 90vw, (max-width: 1100px) 48vw, 610px"
              loading="eager"
              fetchPriority="high"
              className={styles.coverImage}
            />
            <div className={styles.photoTopline}>
              <span>
                <MapPinIcon aria-hidden /> Chamonix, France
              </span>
              <span>45°55′ N · 6°52′ E</span>
            </div>
            <div className={styles.photoCaption}>
              <span>CHANGEZ D’AIR.</span>
              <p>
                Et si c’était
                <br />
                <em>votre quotidien ?</em>
              </p>
            </div>
          </div>
          <div className={styles.sunSeal} aria-label="L’été comme l’hiver">
            <SunSnowIcon aria-hidden />
            <span>L’été comme l’hiver</span>
          </div>
          <span className={styles.heroPhotoIndex}>01 — L’ENVIE D’AILLEURS</span>
        </div>
        <div className={styles.heroSearch}>
          <SeasonSearch signedIn={!!session} />
        </div>
      </section>

      <dl className={styles.trustStrip} aria-label="Nos engagements">
        <div>
          <dt>10 000+</dt>
          <dd>Entreprises explorées partout en France</dd>
        </div>
        <div>
          <dt>Chaque jour</dt>
          <dd>Des offres recherchées et actualisées</dd>
        </div>
        <div>
          <dt>100 % humain</dt>
          <dd>Des échanges directs avec les employeurs</dd>
        </div>
      </dl>

      <section
        className={styles.destinations}
        id="destinations"
        aria-labelledby="destinations-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>
              UN JOB, OUI. MAIS DANS QUEL DÉCOR ?
            </p>
            <h2 id="destinations-title">
              Suivez votre
              <br />
              <em>envie d’ailleurs.</em>
            </h2>
          </div>
          <div className={styles.sectionAside}>
            <p>
              Le plus dur, ce sera peut-être
              <br />
              de choisir où poser vos valises.
            </p>
            <Link href={browse("/offres")} className={styles.textLink}>
              Explorer toutes les offres <ArrowUpRightIcon aria-hidden />
            </Link>
          </div>
        </div>
        <div className={styles.destinationGrid}>
          {destinations.map(
            (
              {
                title,
                subtitle,
                image,
                alt,
                icon: Icon,
                label,
                criteria,
                searchLabel,
              },
              index,
            ) => (
              <Link
                key={title}
                href={browse(searchHref(criteria))}
                className={styles.destinationCard}
                aria-label={searchLabel}
              >
                <div className={styles.destinationImage}>
                  <Image
                    src={image}
                    alt={alt}
                    fill
                    sizes="(max-width: 700px) 90vw, (max-width: 1000px) 45vw, 390px"
                    className={styles.coverImage}
                  />
                  <span className={styles.destinationPill}>
                    <Icon aria-hidden /> {label}
                  </span>
                  <span className={styles.destinationNumber}>0{index + 1}</span>
                  <span className={styles.destinationArrow}>
                    <ArrowUpRightIcon aria-hidden />
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{subtitle}</p>
              </Link>
            ),
          )}
        </div>
        <p className={styles.destinationNote}>
          Des envies pour vous inspirer. Les offres et leurs conditions se
          découvrent dans le catalogue.
        </p>
      </section>

      <section
        className={styles.humanSection}
        id="notre-conviction"
        aria-labelledby="human-title"
      >
        <div className={styles.humanInner}>
          <div className={styles.humanStatement}>
            <p className={styles.eyebrow}>
              NOTRE PLUS BELLE TECHNOLOGIE ? VOUS.
            </p>
            <div className={styles.humanFigures}>
              <span>
                0 % <em>IA.</em>
              </span>
              <span>
                100 %<br />
                <em>humain.</em>
              </span>
            </div>
          </div>
          <div className={styles.humanCopy}>
            <h2 id="human-title">
              Une bonne saison
              <br />
              commence par
              <br /> <em>une vraie rencontre.</em>
            </h2>
            <p>
              Un employeur qui cherche la bonne personne. Quelqu’un qui a envie
              de s’investir. Nous sommes là pour les rapprocher.
            </p>
            <p>
              Pas de candidature automatique. Vous choisissez votre destination,
              vous contactez l’employeur, vous écrivez la suite.
            </p>
            <Link href="/contact" className={styles.lightTextLink}>
              Et derrière ce site ? Un humain aussi.{" "}
              <ArrowUpRightIcon aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section
        className={styles.howSection}
        id="comment-ca-marche"
        aria-labelledby="how-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>
              MOINS DE DÉMARCHES. PLUS DE DÉPARTS.
            </p>
            <h2 id="how-title">
              La suite tient
              <br />
              <em>en trois petits pas.</em>
            </h2>
          </div>
          <p className={styles.handwritten}>
            À vous les grands horizons <ArrowRightIcon aria-hidden />
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNumber}>
              01<span>—</span>
            </span>
            <h3>Venez comme vous êtes.</h3>
            <p>
              Un compte gratuit, vos envies et c’est parti. Pas besoin de CV
              pour commencer à explorer.
            </p>
            <Link href={accountHref} className={styles.textLink}>
              {session ? "Accéder à mon espace" : "Créer un compte"}{" "}
              <ArrowUpRightIcon aria-hidden />
            </Link>
          </li>
          <li>
            <span className={styles.stepNumber}>
              02<span>—</span>
            </span>
            <h3>Trouvez votre terrain de jeu.</h3>
            <p>
              Le métier, le lieu, les dates, le logement : choisissez ce qui
              compte vraiment pour votre saison.
            </p>
            <a href="#recherche" className={styles.textLink}>
              Lancer ma recherche <ArrowUpRightIcon aria-hidden />
            </a>
          </li>
          <li>
            <span className={styles.stepNumber}>
              03<span>↗</span>
            </span>
            <h3>Faites le premier pas.</h3>
            <p>
              Une offre vous parle ? Complétez votre dossier et échangez
              directement avec l’employeur.
            </p>
            <span className={styles.stepFootnote}>
              <HandshakeIcon aria-hidden /> La suite, c’est entre vous.
            </span>
          </li>
        </ol>
      </section>

      <section
        className={styles.employerSection}
        id="recruteurs"
        aria-labelledby="employer-title"
      >
        <div className={styles.employerVisual} aria-hidden>
          <div className={styles.employerIcon}>
            <HandshakeIcon />
          </div>
          <span className={styles.employerWord}>
            L’esprit
            <br />
            <em>d’équipe.</em>
          </span>
          <span className={styles.employerVisualNote}>
            LES MEILLEURES SAISONS
            <br />
            SE VIVENT ENSEMBLE.
          </span>
        </div>
        <div className={styles.employerCopy}>
          <p className={styles.eyebrow}>CÔTÉ RECRUTEURS</p>
          <h2 id="employer-title">
            Les bonnes équipes
            <br />
            font les <em>belles saisons.</em>
          </h2>
          <p>
            Hôtel, restaurant, camping ou lieu de loisirs : rencontrez des
            candidats qui ont choisi la vie de saisonnier.
          </p>
          <ul>
            <li>
              <CheckIcon aria-hidden /> Dépôt d’annonce gratuit
            </li>
            <li>
              <CheckIcon aria-hidden /> Des échanges directs avec les candidats
            </li>
            <li>
              <ShieldCheckIcon aria-hidden /> Un lien à l’entreprise vérifié
              avant publication
            </li>
          </ul>
          <Button asChild size="lg" className={styles.buttonDark}>
            <Link href={employerHref}>
              {session?.user.role === "employer"
                ? "Accéder à mon espace recruteur"
                : "Publier une offre"}{" "}
              <ArrowUpRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div>
          <p className={styles.eyebrow}>AVANT DE FAIRE VOS VALISES</p>
          <h2 id="faq-title">
            Une dernière
            <br />
            <em>petite question ?</em>
          </h2>
          <p className={styles.faqIntro}>
            On préfère quand tout est clair.
            <br />
            Et si besoin, <Link href="/contact">on est là pour vous.</Link>
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
        <div>
          <p className={styles.eyebrow}>LE PROCHAIN CHAPITRE VOUS ATTEND.</p>
          <h2 id="final-title">
            Ça commence par un job.
            <br />
            <em>Ça devient votre histoire.</em>
          </h2>
          <Button asChild size="lg" className={styles.buttonDark}>
            <Link href={accountHref}>
              {session ? "Accéder à mon espace" : "Je me lance"}{" "}
              <ArrowUpRightIcon aria-hidden />
            </Link>
          </Button>
          <span className={styles.finalNote}>
            {session
              ? "Une nouvelle saison, de nouvelles possibilités."
              : "Un compte gratuit. Un monde de possibilités."}
          </span>
        </div>
      </section>
    </div>
  )
}
