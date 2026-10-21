import type { Metadata } from "next"

import { ProvisionalHome } from "@/components/provisional-home"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Administration" }

// Accueil provisoire, remplacé par le tableau de bord admin (plans 04 et 15).
export default async function AdminHomePage() {
  const { user } = await requireRole("admin")
  return <ProvisionalHome title="Administration" user={user} />
}
