import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Mes offres" }

export default async function SavedOffersPage() {
  await requireRole("candidate", "admin")
  return <ComingSoon />
}
