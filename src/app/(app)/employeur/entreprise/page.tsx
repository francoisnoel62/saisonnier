import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Mon entreprise" }

export default function CompanyPage() {
  return <ComingSoon />
}
