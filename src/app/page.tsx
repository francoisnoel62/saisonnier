import Link from "next/link"

import { Button } from "@/components/ui/button"
import { site } from "@/config/site"

// Accueil provisoire, remplacé au plan 06.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{site.name}</h1>
      <p className="max-w-md text-muted-foreground">{site.description}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/inscription">Créer un compte</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    </main>
  )
}
