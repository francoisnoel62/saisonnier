import type { Metadata } from "next"

import { ScanSourcesCard } from "@/components/admin/scan-sources-card"
import { scanSourceSummaries } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Scan" }
export const maxDuration = 120

export default function ScanPage() {
  return <ScanSourcesCard sources={scanSourceSummaries()} />
}
