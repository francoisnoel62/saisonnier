import type { Metadata } from "next"
import Link from "next/link"

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
        <Link className="underline" href="/admin/scan">
          ← Scan
        </Link>
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
