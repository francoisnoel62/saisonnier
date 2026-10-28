import type { Metadata } from "next"
import Link from "next/link"

import { OrchestrationTestCard } from "@/components/admin/scan/orchestration-test"
import { ScanRunCard } from "@/components/admin/scan/scan-run-card"
import { SourcesSummaryCard } from "@/components/admin/scan/sources/sources-summary-card"
import { Button } from "@/components/ui/button"
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
      <nav aria-label="Revue du scan" className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/scan/sources">Sources</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/scan/dossiers">Dossiers à vérifier</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/scan/passages">Passages</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/scan/suggestions">Suggestions de métiers</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/scan/employeurs">Employeurs à inviter</Link>
        </Button>
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
