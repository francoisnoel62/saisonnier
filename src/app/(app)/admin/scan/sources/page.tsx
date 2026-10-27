import type { Metadata } from "next"
import Link from "next/link"

import {
  SourcesTable,
  type SourceListQuery,
} from "@/components/admin/scan/sources/sources-table"
import { sourceListFilters } from "@/domain/scan/source-lifecycle"
import { scanAdapterKinds, scanSourceKinds } from "@/domain/scan/vocabulary"
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
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link className="underline" href="/admin/scan">
          ← Scan
        </Link>
      </nav>
      <SourcesTable rows={await listScanSourceRows()} query={query} />
    </div>
  )
}
