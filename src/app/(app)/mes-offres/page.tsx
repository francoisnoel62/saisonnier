import { BookmarkIcon, CircleCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { OfferCard } from "@/components/offers/offer-card"
import { AppliedButton } from "@/components/offers/tracking-buttons"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireRole } from "@/lib/dal"
import { getTrackedOffers } from "@/server/candidates/tracking"

export const metadata: Metadata = { title: "Mes offres" }

type Tracked = Awaited<ReturnType<typeof getTrackedOffers>>[number]

function TrackedList({
  items,
  footer,
}: {
  items: Tracked[]
  footer?: (item: Tracked) => React.ReactNode
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={item.offer.id}>
          <OfferCard
            offer={item.offer}
            saved={!!item.savedAt}
            // Une offre devenue inactive reste listée, sans coordonnées (la fiche n'en montre pas).
            expired={!item.active}
            footer={footer?.(item)}
          />
        </li>
      ))}
    </ul>
  )
}

function NothingYet({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: string
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/offres">Rechercher des offres</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// Offres sauvegardées et candidatures déclarées (§5) : deux listes, rien de plus. Ni statut de
// pipeline, ni note, ni rappel, ni alerte.
export default async function MyOffersPage() {
  const { user } = await requireRole("candidate")
  const tracked = await getTrackedOffers(user.id)
  const saved = tracked.filter((item) => item.savedAt)
  const applied = tracked.filter((item) => item.appliedAt)

  return (
    <Tabs defaultValue="sauvegardees" className="gap-4">
      <TabsList className="h-10! w-full sm:w-fit">
        <TabsTrigger value="sauvegardees" className="flex-1 px-3">
          Sauvegardées ({saved.length})
        </TabsTrigger>
        <TabsTrigger value="postule" className="flex-1 px-3">
          J&rsquo;ai postulé ({applied.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sauvegardees">
        {saved.length > 0 ? (
          <TrackedList items={saved} />
        ) : (
          <NothingYet
            icon={<BookmarkIcon aria-hidden />}
            title="Aucune offre sauvegardée"
          >
            Sauvegardez une offre depuis la recherche ou sa fiche pour la
            retrouver ici.
          </NothingYet>
        )}
      </TabsContent>

      <TabsContent value="postule">
        {applied.length > 0 ? (
          <TrackedList
            items={applied}
            footer={(item) => (
              <AppliedButton
                offerId={item.offer.id}
                appliedAt={item.appliedAt}
              />
            )}
          />
        ) : (
          <NothingYet
            icon={<CircleCheckIcon aria-hidden />}
            title="Aucune candidature déclarée"
          >
            Après avoir écrit ou téléphoné à un recruteur, indiquez « J’ai
            postulé » sur la fiche de l’offre.
          </NothingYet>
        )}
      </TabsContent>
    </Tabs>
  )
}
