import {
  ArrowUpRightIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  FileCheckIcon,
  HeartHandshakeIcon,
  Repeat2Icon,
  TrendingUpIcon,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductScreenshot } from "./product-screenshot"
import { productImages } from "./product-images"
import styles from "./landing.module.css"

const audiences = [
  {
    value: "saisonniers",
    label: "Je suis saisonnier",
    title: "Un fil conducteur pour votre vie de saisonnier.",
    description:
      "Vos envies évoluent. Votre expérience grandit. Votre espace vous accompagne pour trouver la bonne saison et préparer la suivante.",
    image: productImages.candidateTracking,
    imageTitle:
      "Mes offres : les opportunités sauvegardées et les candidatures déclarées",
    tone: "sage" as const,
    cta: "Construire ma prochaine saison",
    features: [
      {
        icon: FileCheckIcon,
        title: "Un dossier qui vous suit",
        text: "Rassemblez vos coordonnées, votre CV et votre message de candidature dans un même espace.",
        future: false,
      },
      {
        icon: BookmarkIcon,
        title: "Vos démarches, au même endroit",
        text: "Retrouvez vos offres sauvegardées et celles auxquelles vous avez postulé. Gardez le fil de vos recherches.",
        future: false,
      },
      {
        icon: CalendarDaysIcon,
        title: "Une vue sur les saisons d’après",
        text: "Notre prochaine étape : relier vos disponibilités, vos expériences et vos projets dans un calendrier de carrière.",
        future: true,
      },
    ],
  },
  {
    value: "employeurs",
    label: "Je suis employeur",
    title: "Votre prochaine équipe commence avec celle d’aujourd’hui.",
    description:
      "Recruter ne s’arrête pas à une prise de poste. Notre ambition : vous aider à anticiper les besoins, fidéliser vos équipes et faire mieux à chaque saison.",
    image: productImages.employerOffers,
    imageTitle: "Mes annonces : la gestion des recrutements saisonniers",
    tone: "peach" as const,
    cta: "Préparer mes recrutements",
    features: [
      {
        icon: FileCheckIcon,
        title: "Recruter avec une vue claire",
        text: "Centralisez vos annonces, précisez les dates et les conditions, puis gérez leur publication depuis votre espace.",
        future: false,
      },
      {
        icon: HeartHandshakeIcon,
        title: "Fidéliser et réembaucher",
        text: "À venir : un vivier de saisonniers pour garder le lien, recueillir les envies de retour et retrouver les bonnes personnes.",
        future: true,
      },
      {
        icon: TrendingUpIcon,
        title: "Anticiper et progresser",
        text: "À venir : un calendrier des besoins et des bilans de saison pour repérer les tensions et améliorer vos recrutements.",
        future: true,
      },
    ],
  },
]

export function AudienceFeatures({
  candidateHref,
  employerHref,
}: {
  candidateHref: string
  employerHref: string
}) {
  return (
    <section
      id="le-logiciel"
      className={styles.features}
      aria-labelledby="features-title"
    >
      <div className={styles.sectionIntro}>
        <span className={styles.eyebrow}>BIEN PLUS QU’UNE RENCONTRE</span>
        <h2 id="features-title">
          Le début d’une saison.
          <br />
          <em>La suite d’une histoire.</em>
        </h2>
      </div>
      <Tabs defaultValue="saisonniers" className="gap-10 md:gap-14">
        <TabsList
          aria-label="Découvrir le logiciel selon mon profil"
          className={styles.audienceTabs}
        >
          {audiences.map((audience) => (
            <TabsTrigger
              key={audience.value}
              value={audience.value}
              className={styles.audienceTab}
            >
              {audience.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {audiences.map((audience) => (
          <TabsContent
            key={audience.value}
            value={audience.value}
            className="space-y-10 md:space-y-14"
          >
            <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <span className={styles.smallIcon}>
                  <Repeat2Icon aria-hidden />
                </span>
                <h3 className={styles.featureHeadline}>{audience.title}</h3>
                <p className={styles.bodyCopy}>{audience.description}</p>
                <Button asChild className="mt-7 h-12 rounded-full px-6">
                  <Link
                    href={
                      audience.value === "saisonniers"
                        ? candidateHref
                        : employerHref
                    }
                  >
                    {audience.cta}
                    <ArrowUpRightIcon aria-hidden />
                  </Link>
                </Button>
              </div>
              <ProductScreenshot
                src={audience.image}
                title={audience.imageTitle}
                tone={audience.tone}
              />
            </div>
            <div className="grid gap-8 md:grid-cols-3 md:gap-10">
              {audience.features.map(({ icon: Icon, title, text, future }) => (
                <article
                  key={title}
                  className="border-t border-[var(--ms-line)] pt-6"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <Icon className="size-5" aria-hidden />
                    <Badge
                      variant="outline"
                      className="rounded-full border-[var(--ms-line)] font-normal text-[var(--ms-muted)]"
                    >
                      {future ? "À venir" : "Disponible aujourd’hui"}
                    </Badge>
                  </div>
                  <h4 className="text-lg font-medium tracking-tight">
                    {title}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--ms-muted)]">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
