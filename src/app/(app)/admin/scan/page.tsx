import type { Metadata } from "next"
import Link from "next/link"

import { ScanSourcesCard } from "@/components/admin/scan-sources-card"
import { listScanSources } from "@/server/scan/sources/state"

export const metadata: Metadata = { title: "Scan" }
export const maxDuration = 120

export default async function ScanPage() {
  return (
    <div className="grid gap-6">
      <nav aria-label="Revue du scan" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/admin/scan/dossiers">
          Dossiers à vérifier
        </Link>
        <Link className="underline" href="/admin/scan/suggestions">
          Suggestions de métiers
        </Link>
      </nav>
      <ScanSourcesCard sources={await listScanSources()} />
    </div>
  )
}
