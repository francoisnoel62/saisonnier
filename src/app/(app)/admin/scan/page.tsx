import type { Metadata } from "next"
import Link from "next/link"

import { OrchestrationTestCard } from "@/components/admin/scan/orchestration-test"
import { ScanRunCard } from "@/components/admin/scan/scan-run-card"
import { SourcesSummaryCard } from "@/components/admin/scan/sources/sources-summary-card"
import { bootstrapRunExists } from "@/server/scan/queries"
import { getScanSnapshot } from "@/server/scan/snapshot"
import {
  listRunnableSources,
  listScanSourceRows,
} from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Scan" }

export default async function ScanPage() {
  const [rows, snapshot, launched, runnable] = await Promise.all([
    listScanSourceRows(),
    getScanSnapshot({ limit: 1 }),
    bootstrapRunExists(),
    listRunnableSources("bootstrap"),
  ])
  return (
    <div className="grid gap-6">
      <nav aria-label="Revue du scan" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/admin/scan/sources">
          Sources
        </Link>
        <Link className="underline" href="/admin/scan/dossiers">
          Dossiers à vérifier
        </Link>
        <Link className="underline" href="/admin/scan/passages">
          Passages
        </Link>
        <Link className="underline" href="/admin/scan/suggestions">
          Suggestions de métiers
        </Link>
        <Link className="underline" href="/admin/scan/employeurs">
          Employeurs à inviter
        </Link>
      </nav>
      <ScanRunCard
        initial={{ run: snapshot.run, counts: snapshot.counts }}
        bootstrapLaunched={launched}
        runnableSources={runnable.length}
      />
      <SourcesSummaryCard rows={rows} />
      <OrchestrationTestCard />
    </div>
  )
}
