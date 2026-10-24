import type { Metadata } from "next"

import { ScanSourcesCard } from "@/components/admin/scan-sources-card"
import { listScanSources } from "@/server/scan/sources/state"

export const metadata: Metadata = { title: "Scan" }
export const maxDuration = 120

export default async function ScanPage() {
  return <ScanSourcesCard sources={await listScanSources()} />
}
