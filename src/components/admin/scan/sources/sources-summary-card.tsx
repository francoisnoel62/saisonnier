import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ScanSourceListRow } from "@/server/scan/sources/registry"

// Carte « Sources » de /admin/scan : décompte par statut et sources qui demandent une action.
export function SourcesSummaryCard({ rows }: { rows: ScanSourceListRow[] }) {
  const counts = [
    {
      label: "Activées",
      value: rows.filter((row) => row.status === "ready" && row.enabled).length,
    },
    {
      label: "Prêtes",
      value: rows.filter((row) => row.status === "ready").length,
    },
    {
      label: "Brouillons",
      value: rows.filter((row) => row.status === "draft").length,
    },
    {
      label: "Écartées",
      value: rows.filter((row) => row.status === "rejected").length,
    },
  ]
  const alerts = [
    ...rows
      .filter((row) => row.suspended)
      .map((row) => `${row.label} : suspendue.`),
    ...rows
      .filter(
        (row) =>
          row.status === "ready" && row.lastTest && !row.lastTest.current,
      )
      .map(
        (row) => `${row.label} : dernier test sur une ancienne configuration.`,
      ),
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sources du scan</h2>
        </CardTitle>
        <CardDescription>
          Portails employeurs et découvertes lus par le scan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map((count) => (
            <div key={count.label} className="rounded-lg border p-3">
              <dt className="text-sm text-muted-foreground">{count.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {count.value}
              </dd>
            </div>
          ))}
        </dl>
        {alerts.length > 0 && (
          <ul className="list-inside list-disc text-sm">
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full sm:w-fit">
          <Link href="/admin/scan/sources">Gérer les sources</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
