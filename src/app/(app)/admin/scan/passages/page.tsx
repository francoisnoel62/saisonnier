import type { Metadata } from "next"
import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  scanModeLabels,
  scanRunStatusLabels,
  scanRunTriggerLabels,
} from "@/domain/scan/vocabulary"
import { listRuns } from "@/server/scan/queries"

export const metadata: Metadata = { title: "Passages du scan" }

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
})

// Historique des passages (plan scan 09) : les plus récents d'abord.
export default async function ScanRunsPage() {
  const runs = await listRuns(50)
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link className="underline" href="/admin/scan">
          ← Scan
        </Link>
      </nav>
      {runs.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Début</TableHead>
              <TableHead>Passage</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Livrés</TableHead>
              <TableHead>Déclenché par</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link
                    className="underline"
                    href={`/admin/scan/passages/${run.id}`}
                  >
                    {dateTime.format(run.startedAt)}
                  </Link>
                </TableCell>
                <TableCell>{scanModeLabels[run.mode]}</TableCell>
                <TableCell>{scanRunStatusLabels[run.status]}</TableCell>
                <TableCell className="text-right">
                  {run.targetCount
                    ? `${run.deliveredCount} / ${run.targetCount}`
                    : run.deliveredCount}
                </TableCell>
                <TableCell>{scanRunTriggerLabels[run.trigger]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun passage pour l’instant.
        </p>
      )}
    </div>
  )
}
