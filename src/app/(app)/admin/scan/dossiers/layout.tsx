import { ScanQueue } from "@/components/admin/scan/scan-queue"
import { getScanSnapshot } from "@/server/scan/snapshot"

export default async function ScanDossiersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ScanQueue initial={await getScanSnapshot()}>{children}</ScanQueue>
}
