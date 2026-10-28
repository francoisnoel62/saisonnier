import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EmployerLeads } from "@/components/admin/scan/employer-leads"
import {
  discoveryRadar,
  listEmployerLeads,
} from "@/server/scan/sources/learning"

export const metadata: Metadata = { title: "Employeurs à inviter" }

export default async function EmployerLeadsPage() {
  const [leads, radar] = await Promise.all([
    listEmployerLeads(),
    discoveryRadar(),
  ])
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Button
          asChild
          variant="ghost"
          className="h-auto min-h-11 w-fit max-w-full text-left whitespace-normal"
        >
          <Link href="/admin/scan">← Scan</Link>
        </Button>
      </nav>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Employeurs révélés par la découverte qui n’ont pas de portail carrière :
        invitez-les à déposer leurs annonces eux-mêmes. Un compte employeur créé
        avec le même SIREN résout la piste.
      </p>
      <EmployerLeads leads={leads} proposals={radar.proposals} />
    </div>
  )
}
