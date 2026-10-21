import type { Metadata } from "next"

import { ProvisionalHome } from "@/components/provisional-home"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Offres" }

// Accueil provisoire, remplacé par la recherche (plans 04 et 09).
export default async function OffersPage() {
  const { user } = await requireRole("candidate", "admin")
  return <ProvisionalHome title="Offres saisonnières" user={user} />
}
