import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDuration } from "@/domain/scan/run-progress"
import {
  exclusionReasonLabels,
  rejectionReasonLabels,
  scanCandidateStatusLabels,
  scanModeLabels,
  scanRunSourceStatusLabels,
  scanRunStatusLabels,
} from "@/domain/scan/vocabulary"
import { getRunReport } from "@/server/scan/queries"

export const metadata: Metadata = { title: "Bilan du passage" }

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
})
const at = (value: Date | null) => (value ? dateTime.format(value) : "—")
const megabytes = (bytes: number) =>
  `${(bytes / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`

// Bilan d'un passage (plan scan 09, getRunReport) : collecte, seuil, décisions et consommation.
// Publications humaines et automatiques restent distinctes du délai de livraison.
export default async function ScanRunReportPage({
  params,
}: PageProps<"/admin/scan/passages/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const report = await getRunReport(id)
  if (!report) notFound()
  const { run } = report
  const sinceStart = (value: Date | null) =>
    value
      ? ` (T+${formatDuration(value.getTime() - run.startedAt.getTime())})`
      : ""
  const requests = report.sources.reduce(
    (sum, source) => sum + source.requestCount,
    0,
  )
  const bytes = report.sources.reduce(
    (sum, source) => sum + source.bytesDownloaded,
    0,
  )
  const facts: [string, string][] = [
    [
      "Passage",
      `${scanModeLabels[run.mode]} · ${scanRunStatusLabels[run.status]}`,
    ],
    ["Début (T0)", at(run.startedAt)],
    ...(run.deadlineAt
      ? ([["Échéance", at(run.deadlineAt)]] as [string, string][])
      : []),
    ["Fin", at(run.finishedAt)],
    [
      "Dossiers livrés",
      run.targetCount
        ? `${run.deliveredCount} / ${run.targetCount}`
        : String(run.deliveredCount),
    ],
    ...(run.deadlineAt
      ? ([
          ["Livrés avant l’échéance", String(report.deliveredBeforeDeadline)],
          [
            "Seuil atteint",
            `${at(report.targetReachedAt)}${sinceStart(report.targetReachedAt)}`,
          ],
          [
            "Seuil confirmé (sans les rejets d’admission)",
            `${at(report.confirmedTargetReachedAt)}${sinceStart(report.confirmedTargetReachedAt)}`,
          ],
        ] as [string, string][])
      : []),
    [
      "Premier dossier livré",
      `${at(report.firstDeliveredAt)}${sinceStart(report.firstDeliveredAt)}`,
    ],
    ["Doublons potentiels", String(report.duplicates)],
    ["Publications humaines", String(report.publications.human)],
    ["Publications automatiques", String(report.publications.automatic)],
    ["Requêtes et octets", `${requests} requêtes · ${megabytes(bytes)}`],
    ["Workflow", run.workflowRunId ?? "aucun"],
  ]
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="flex gap-4 text-sm">
        <Link className="underline" href="/admin/scan">
          ← Scan
        </Link>
        <Link className="underline" href="/admin/scan/passages">
          Passages
        </Link>
      </nav>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="grid min-w-0 gap-2">
        <h2 className="font-semibold">Par source</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="text-right">Listées</TableHead>
              <TableHead className="text-right">Lues</TableHead>
              <TableHead className="text-right">Livrées</TableHead>
              <TableHead className="text-right">Écartées</TableHead>
              <TableHead className="text-right">Échecs</TableHead>
              <TableHead className="text-right">Requêtes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.sources.map((source) => (
              <TableRow key={source.sourceKey}>
                <TableCell>
                  <Link
                    className="underline"
                    href={`/admin/scan/sources/${source.sourceKey}`}
                  >
                    {source.label}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    v{source.sourceRevision}
                  </span>
                </TableCell>
                <TableCell>
                  {scanRunSourceStatusLabels[source.status]}
                  {source.lastError && (
                    <div className="text-xs text-muted-foreground">
                      {source.lastError}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {source.listedCount}
                </TableCell>
                <TableCell className="text-right">
                  {source.fetchedCount}
                </TableCell>
                <TableCell className="text-right">
                  {source.deliveredCount}
                </TableCell>
                <TableCell className="text-right">
                  {source.excludedCount}
                </TableCell>
                <TableCell className="text-right">
                  {source.failedCount}
                </TableCell>
                <TableCell className="text-right">
                  {source.requestCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Counts
          title="Dossiers par état"
          rows={report.byStatus.map((row) => [
            scanCandidateStatusLabels[row.status],
            row.count,
          ])}
        />
        <Counts
          title="Exclusions par motif"
          rows={report.exclusions.map((row) => [
            row.reason ? exclusionReasonLabels[row.reason] : "—",
            row.count,
          ])}
        />
        <Counts
          title="Rejets par motif"
          rows={report.rejections.map((row) => [
            row.reason ? rejectionReasonLabels[row.reason] : "—",
            row.count,
          ])}
        />
      </section>
    </div>
  )
}

function Counts({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="grid gap-1">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between gap-2">
              <span>{label}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Aucun.</p>
      )}
    </div>
  )
}
