import { SunSnowIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { site } from "@/config/site"
import { homePathFor, type Role } from "@/domain/roles"

// En-tête des pages publiques. `role` est absent pour un visiteur non connecté.
export function PublicHeader({ role }: { role?: Role }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SunSnowIcon className="size-4" aria-hidden />
          </span>
          {site.name}
        </Link>
        <nav
          aria-label="Navigation principale"
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          {role ? (
            <Button asChild size="sm">
              <Link href={homePathFor(role)}>Accéder à mon espace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/inscription/employeur">
                  Employeurs : publier une offre
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/connexion">Se connecter</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/inscription">Créer un compte</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
