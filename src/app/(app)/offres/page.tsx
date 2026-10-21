import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Rechercher des offres" }

export default async function OffersPage() {
  await requireRole("candidate", "admin")
  return <ComingSoon />
}
