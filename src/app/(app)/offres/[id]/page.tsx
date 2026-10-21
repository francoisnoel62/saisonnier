import { ArrowLeftIcon, CircleOffIcon, EyeOffIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import {
  ApplicationPanel,
  HowToApply,
} from "@/components/offers/application-panel"
import {
  OfferDetails,
  toOfferDetailsData,
} from "@/components/offers/offer-details"
import { OfferProvenance } from "@/components/offers/offer-provenance"
import { SaveOfferButton } from "@/components/offers/tracking-buttons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  applicationModeExplanation,
  publicCompanyName,
} from "@/domain/application"
import { expiryReason, isActive, todayInParis } from "@/domain/offer-activity"
import { seasonLabels } from "@/domain/offer-display"
import { requireRole } from "@/lib/dal"
import { getTracking } from "@/server/candidates/tracking"
import { getApplicationDetails } from "@/server/offers/application"
import {
  getOfferWithRelations,
  type OfferWithRelations,
} from "@/server/offers/queries"

// Une seule lecture par requête, pour les métadonnées et la page.
const loadOffer = cache(getOfferWithRelations)

// Le titre de l'onglet ne nomme que l'entreprise publique (anonymat, §7).
export async function generateMetadata({
  params,
}: PageProps<"/offres/[id]">): Promise<Metadata> {
  const offer = await loadOffer((await params).id)
  if (!offer?.publishedAt) return { title: "Offre introuvable" }
  return { title: `${offer.title} – ${publicCompanyName(offer)}` }
}

// Pourquoi une offre n'est plus proposée (§6).
function inactiveReason(offer: OfferWithRelations, today: string) {
  if (offer.status === "published") {
    return expiryReason(offer, today) === "deadline"
      ? "La date limite de candidature est passée."
      : "La période du contrat est terminée."
  }
  if (offer.status === "unpublished")
    return "Elle a été retirée par l'employeur."
  if (offer.status === "expired") return "Elle est arrivée à échéance."
  return "Elle n'est pas publiée."
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="lg" className="self-start">
      <Link href="/offres">
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        Retour aux offres
      </Link>
    </Button>
  )
}

// Fiche d'une offre (§3, §5, §7) : toute l'information, sans rien inventer, et la façon de
// candidater. Les coordonnées ne sont rendues que pour un dossier complet (H3), ou pour l'admin.
export default async function OfferPage({ params }: PageProps<"/offres/[id]">) {
  const { user } = await requireRole("candidate", "admin")
  const offer = await loadOffer((await params).id)
  const isAdmin = user.role === "admin"
  // Jamais publiée (en attente, refusée) : elle n'existe pas pour un candidat.
  if (!offer || (!isAdmin && !offer.publishedAt)) notFound()

  const companyName = publicCompanyName(offer)
  const today = todayInParis(new Date())
  const active = isActive(offer, today)

  if (!active && !isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BackLink />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleOffIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Cette offre n&rsquo;est plus active</EmptyTitle>
            <EmptyDescription>
              <span className="block font-medium text-foreground">
                {offer.title}
              </span>
              <span className="block">{companyName}</span>
              <span className="mt-2 block">{inactiveReason(offer, today)}</span>
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/offres">Voir les offres actives</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const [application, tracking] = await Promise.all([
    getApplicationDetails(offer.id, user),
    // L'admin ne suit pas d'offres.
    isAdmin
      ? null
      : getTracking(user.id, [offer.id]).then((map) => map.get(offer.id)),
  ])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <BackLink />

      {!active && (
        <Alert>
          <EyeOffIcon aria-hidden />
          <AlertTitle>
            Cette offre n&rsquo;est pas visible des candidats
          </AlertTitle>
          <AlertDescription>{inactiveReason(offer, today)}</AlertDescription>
        </Alert>
      )}

      <header className="flex flex-col gap-2">
        <Badge variant="secondary">{seasonLabels[offer.season]}</Badge>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {offer.title}
          </h2>
          {!isAdmin && (
            <SaveOfferButton
              offerId={offer.id}
              title={offer.title}
              saved={!!tracking?.savedAt}
              withLabel
            />
          )}
        </div>
        <p className="text-lg text-muted-foreground">{companyName}</p>
        <OfferProvenance
          offerId={offer.id}
          origin={offer.origin}
          companyName={companyName}
          validityConfirmedAt={offer.validityConfirmedAt}
          sourceCheckedAt={offer.sourceCheckedAt}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:order-2">
          <HowToApply explanation={applicationModeExplanation(offer)} />
          {application.status !== "inactive" && (
            <ApplicationPanel
              offerId={offer.id}
              details={application}
              appliedAt={tracking?.appliedAt ?? null}
            />
          )}
        </aside>
        <OfferDetails offer={toOfferDetailsData(offer)} />
      </div>
    </div>
  )
}
