import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { requireRole } from "@/lib/dal"

export const metadata: Metadata = { title: "Mon dossier" }

export default async function ProfilePage() {
  await requireRole("candidate", "admin")
  return <ComingSoon />
}
