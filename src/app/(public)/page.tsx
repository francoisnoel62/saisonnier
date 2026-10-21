import {
  BriefcaseBusinessIcon,
  HandshakeIcon,
  ListFilterIcon,
  type LucideIcon,
  SearchIcon,
  SendIcon,
  UserRoundPlusIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { site } from "@/config/site"
import { homePathFor } from "@/domain/roles"
import { getSession } from "@/lib/dal"

// Aucune offre n'est montrée ici : le catalogue est réservé aux comptes (§5).
export const metadata: Metadata = {
  title: { absolute: `${site.name} · Emplois saisonniers en France` },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: site.name,
    title: `${site.name} · Emplois saisonniers en France`,
    description: site.description,
    url: "/",
  },
}

const differentiators: {
  icon: LucideIcon
  title: string
  text: string
}[] = [
  {
    icon: HandshakeIcon,
    title: "Des annonces en direct des employeurs",
    text: "Vous candidatez directement auprès de l'employeur, sans passer par un autre job-board.",
  },
  {
    icon: ListFilterIcon,
    title: "Des filtres qui se combinent",
    text: "Logement, repas, dates, salaire net ou brut, couples, animaux… Cumulez vos critères et voyez les résultats se mettre à jour.",
  },
]

const steps: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: UserRoundPlusIcon,
    title: "Créez votre compte gratuit",
    text: "Quelques minutes suffisent, et la recherche ne demande pas de CV.",
  },
  {
    icon: SearchIcon,
    title: "Recherchez une offre",
    text: "Filtrez selon ce qui compte pour vous : saison, région, logement, salaire.",
  },
  {
    icon: SendIcon,
    title: "Candidatez directement",
    text: "Vous envoyez vous-même votre dossier à l'employeur : rien n'est transmis sans vous.",
  },
]

export default async function HomePage() {
  const session = await getSession()

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-start gap-6 py-6 md:py-10">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Des emplois explicitement saisonniers, l&apos;été comme l&apos;hiver
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {site.name} réunit des offres dans le tourisme et l&apos;hôtellerie de
          loisirs, partout en France : stations de ski, campings, hôtels,
          restaurants, parcs et centres de loisirs.
        </p>
        <div className="flex flex-wrap gap-3">
          {session ? (
            <Button asChild size="lg">
              <Link href={homePathFor(session.user.role)}>
                Accéder à mon espace
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/inscription/candidat">
                  Créer mon compte gratuit
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/connexion">Se connecter</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="differences" className="flex flex-col gap-6">
        <h2 id="differences" className="text-2xl font-semibold tracking-tight">
          Ce qui change
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {differentiators.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-lg border p-5">
              <Icon
                className="mt-0.5 size-6 shrink-0 text-primary"
                aria-hidden
              />
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="comment" className="flex flex-col gap-6">
        <h2 id="comment" className="text-2xl font-semibold tracking-tight">
          Comment ça marche
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-lg border p-5"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <h3 className="font-medium">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="employeurs"
        className="flex flex-col gap-4 rounded-lg bg-muted p-6 md:p-8"
      >
        <h2
          id="employeurs"
          className="flex items-center gap-2 text-2xl font-semibold tracking-tight"
        >
          <BriefcaseBusinessIcon className="size-6" aria-hidden />
          Vous recrutez des saisonniers ?
        </h2>
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 text-muted-foreground">
          <li>
            Le dépôt d&apos;une annonce est gratuit, et les candidats vous
            contactent directement.
          </li>
          <li>
            Nous vérifions le lien entre le déposant et l&apos;entreprise avant
            la publication.
          </li>
          <li>
            Des prestations complémentaires sont possibles sur demande, sans
            garantie d&apos;embauche.
          </li>
        </ul>
        <div>
          <Button asChild>
            <Link href="/inscription/employeur">
              Employeurs : publier une offre
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
