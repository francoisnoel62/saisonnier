import type { Metadata } from "next"

import { ProvisionalHome } from "@/components/provisional-home"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Espace employeur" }

// Accueil provisoire, remplacé par le tableau de bord employeur (plans 04 et 14).
export default async function EmployerHomePage() {
  const { user } = await requireRole("employer")
  return <ProvisionalHome title="Espace employeur" user={user} />
}
