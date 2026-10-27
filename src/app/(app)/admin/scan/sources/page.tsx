import type { Metadata } from "next"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

import {
  SourcesTable,
  type SourceListQuery,
} from "@/components/admin/scan/sources/sources-table"
import { Button } from "@/components/ui/button"
import { sourceListFilters } from "@/domain/scan/source-lifecycle"
import { scanAdapterKinds, scanSourceKinds } from "@/domain/scan/vocabulary"
import { sourceHealthSummaries } from "@/server/scan/sources/health"
import { discoveryRadar } from "@/server/scan/sources/learning"
import { listScanSourceRows } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Sources du scan" }
// Sonde et échantillon lancés depuis le menu d'une source.
export const maxDuration = 120

function one<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const item = Array.isArray(value) ? value[0] : value
  return allowed.find((candidate) => candidate === item)
}

async function rowsWithHealth() {
  const [rows, health] = await Promise.all([
    listScanSourceRows(),
    sourceHealthSummaries(),
  ])
  return rows.map((row) => ({ ...row, health: health.get(row.key)?.health }))
}

// Compteurs du radar de la découverte (lot F).
async function RadarCounters() {
  const radar = await discoveryRadar()
  return (
    <p className="text-sm">
      {radar.portalsWithoutSource} portail
      {radar.portalsWithoutSource > 1 ? "s" : ""} employeur
      {radar.portalsWithoutSource > 1 ? "s" : ""} repéré
      {radar.portalsWithoutSource > 1 ? "s" : ""} par la découverte, sans source
      ·{" "}
      <Link className="underline" href="/admin/scan/employeurs">
        {radar.employersToInvite} employeur
        {radar.employersToInvite > 1 ? "s" : ""} à inviter
      </Link>
    </p>
  )
}

export default async function ScanSourcesPage({
  searchParams,
}: PageProps<"/admin/scan/sources">) {
  const params = await searchParams
  const q = Array.isArray(params.q) ? params.q[0] : params.q
  const query: SourceListQuery = {
    statut: one(params.statut, sourceListFilters) ?? "toutes",
    type: one(params.type, scanSourceKinds),
    connecteur: one(params.connecteur, scanAdapterKinds),
    q: q?.slice(0, 100) || undefined,
  }
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Fil d’Ariane" className="text-sm">
          <Link className="underline" href="/admin/scan">
            ← Scan
          </Link>
        </nav>
        <Button asChild className="w-full sm:w-fit">
          <Link href="/admin/scan/sources/nouvelle">
            <PlusIcon aria-hidden />
            Ajouter une source
          </Link>
        </Button>
      </div>
      <RadarCounters />
      <SourcesTable rows={await rowsWithHealth()} query={query} />
    </div>
  )
}
