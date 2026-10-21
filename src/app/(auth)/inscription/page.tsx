import {
  BriefcaseBusinessIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { FieldDescription } from "@/components/ui/field"

export const metadata: Metadata = { title: "Créer un compte" }

const choices = [
  {
    href: "/inscription/candidat",
    icon: SearchIcon,
    title: "Je cherche un job saisonnier",
    description: "Recherchez des offres et candidatez directement.",
  },
  {
    href: "/inscription/employeur",
    icon: BriefcaseBusinessIcon,
    title: "Je recrute",
    description: "Publiez vos annonces pour la saison.",
  },
] as const

// Un compte = un rôle (H1) : le choix se fait ici, une fois pour toutes.
export default function SignUpChoicePage() {
  return (
    <AuthCard title="Créer un compte" description="Vous êtes…">
      <div className="flex flex-col gap-3">
        {choices.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg border p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium">{title}</span>
              <span className="text-muted-foreground">{description}</span>
            </span>
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ))}
        <FieldDescription className="mt-3 text-center">
          Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        </FieldDescription>
      </div>
    </AuthCard>
  )
}
