import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { SourceWizard } from "@/components/admin/scan/sources/source-wizard"

export const metadata: Metadata = { title: "Ajouter une source" }
// La détection lit la page de départ depuis ce déploiement.
export const maxDuration = 120

export default async function NewScanSourcePage({
  searchParams,
}: PageProps<"/admin/scan/sources/nouvelle">) {
  const params = await searchParams
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.slice(0, 2048) || undefined
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Button
          asChild
          variant="ghost"
          className="h-auto min-h-11 w-fit max-w-full text-left whitespace-normal"
        >
          <Link href="/admin/scan/sources">← Sources</Link>
        </Button>
      </nav>
      <SourceWizard
        initial={{
          url: one(params.url),
          employerName: one(params.employeur)?.slice(0, 200),
          siren: one(params.siren)?.slice(0, 20),
          candidateId: one(params.dossier),
        }}
      />
    </div>
  )
}
