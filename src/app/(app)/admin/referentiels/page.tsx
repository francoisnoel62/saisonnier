import type { Metadata } from "next"

import { BlockedDomainsManager } from "@/components/admin/blocked-domains-manager"
import { OccupationsManager } from "@/components/admin/occupations-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  listBlockedDomainsForAdmin,
  listOccupationFamilies,
  listOccupationsForAdmin,
  publishedOffersPointingTo,
} from "@/server/referentials/admin"

export const metadata: Metadata = { title: "Référentiels" }

const tabs = ["metiers", "domaines-exclus"] as const

// Référentiels gérés sans toucher au code (plan 15) : métiers et domaines exclus. Régions et
// départements ne changent que par migration.
export default async function ReferentialsPage({
  searchParams,
}: PageProps<"/admin/referentiels">) {
  const { onglet } = await searchParams
  const tab = tabs.find((value) => value === onglet) ?? "metiers"

  const [occupations, families, domains] = await Promise.all([
    listOccupationsForAdmin(),
    listOccupationFamilies(),
    listBlockedDomainsForAdmin(),
  ])
  const affected = await publishedOffersPointingTo(
    domains.map((row) => row.domain),
  )

  return (
    <Tabs defaultValue={tab} className="gap-4">
      <TabsList>
        <TabsTrigger value="metiers">Métiers</TabsTrigger>
        <TabsTrigger value="domaines-exclus">Domaines exclus</TabsTrigger>
      </TabsList>
      <TabsContent value="metiers">
        <OccupationsManager
          occupations={occupations.map((occupation) => ({
            id: occupation.id,
            slug: occupation.slug,
            label: occupation.label,
            family: occupation.family,
            isActive: occupation.isActive,
            offerCount: occupation.offerCount,
          }))}
          families={families}
        />
      </TabsContent>
      <TabsContent value="domaines-exclus">
        <BlockedDomainsManager
          domains={domains.map((row) => ({
            domain: row.domain,
            reason: row.reason,
            createdAt: row.createdAt.toISOString(),
          }))}
          affected={affected}
        />
      </TabsContent>
    </Tabs>
  )
}
