import type { Metadata } from "next"
import Link from "next/link"

import { SourceWizard } from "@/components/admin/scan/sources/source-wizard"

export const metadata: Metadata = { title: "Ajouter une source" }
// La détection lit la page de départ depuis ce déploiement.
export const maxDuration = 120

export default function NewScanSourcePage() {
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link className="underline" href="/admin/scan/sources">
          ← Sources
        </Link>
      </nav>
      <SourceWizard />
    </div>
  )
}
