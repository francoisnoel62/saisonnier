import type { Metadata } from "next"

import { ScanSourcesCard } from "@/components/admin/scan-sources-card"
import { scanSourceDefinitions } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Scan" }
export const maxDuration = 120

export default function ScanPage() {
  return (
    <ScanSourcesCard
      sources={Object.values(scanSourceDefinitions)
        .sort((a, b) => a.priority - b.priority)
        .map((source) => ({
          key: source.key,
          label: source.label,
          role: source.role,
          officialHosts: source.officialHosts,
          checkedAt: [
            source.affiliationProof.checkedAt,
            source.reuse.checkedAt,
          ].sort()[0],
        }))}
    />
  )
}
