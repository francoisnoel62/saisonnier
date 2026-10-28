import type { Metadata } from "next"
import Link from "next/link"

import { SourcesSummaryCard } from "@/components/admin/scan/sources/sources-summary-card"
import { listScanSourceRows } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Scan" }

export default async function ScanPage() {
  return (
    <div className="grid gap-6">
      <nav aria-label="Revue du scan" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/admin/scan/sources">
          Sources
        </Link>
        <Link className="underline" href="/admin/scan/dossiers">
          Dossiers à vérifier
        </Link>
        <Link className="underline" href="/admin/scan/suggestions">
          Suggestions de métiers
        </Link>
        <Link className="underline" href="/admin/scan/employeurs">
          Employeurs à inviter
        </Link>
      </nav>
      <SourcesSummaryCard rows={await listScanSourceRows()} />
    </div>
  )
}
