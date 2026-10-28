import "server-only"
import { OfferHero, OfferSummary } from "./offer-visuals"
import styles from "./offers.module.css"
import { ArrowLeftIcon, CircleOffIcon, EyeOffIcon } from "lucide-react"
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
import { requireRole } from "@/lib/dal"
import { getTracking } from "@/server/candidates/tracking"
import {
  getApplicationDetails,
  getBlockedDomains,
} from "@/server/offers/application"
import {
  getOfferWithRelations,
  type OfferWithRelations,
} from "@/server/offers/queries"

// Une seule lecture par requête, pour les métadonnées et la page.
export const loadCandidateOffer = cache(getOfferWithRelations)

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

function BackLink({ href }: { href: string }) {
  return (
    <Button asChild variant="ghost" size="lg" className="self-start">
      <Link href={href}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        Retour aux offres
      </Link>
    </Button>
  )
}

// Fiche d'une offre (§3, §5, §7) : toute l'information, sans rien inventer, et la façon de
// candidater. Les coordonnées ne sont rendues que pour un dossier complet (H3), ou pour l'admin.
export async function OfferContent({
  id,
  embedded = false,
  returnHref = "/offres",
}: {
  id: string
  embedded?: boolean
  returnHref?: string
}) {
  const { user } = await requireRole("candidate", "admin")
  const offer = await loadCandidateOffer(id)
  const isAdmin = user.role === "admin"
  // Jamais publiée (en attente, refusée) : elle n'existe pas pour un candidat.
  if (!offer || (!isAdmin && !offer.publishedAt)) notFound()

  const companyName = publicCompanyName(offer)
  const today = todayInParis(new Date())
  const active = isActive(offer, today)

  if (!active && !isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {!embedded && <BackLink href={returnHref} />}
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

  const [application, tracking, blockedDomains] = await Promise.all([
    getApplicationDetails(offer.id, user),
    // L'admin ne suit pas d'offres.
    isAdmin
      ? null
      : getTracking(user.id, [offer.id]).then((map) => map.get(offer.id)),
    getBlockedDomains(),
  ])
  const details = toOfferDetailsData(offer, { blockedDomains })

  return (
    <div
      className={`${styles.detailRoot} mx-auto flex w-full max-w-5xl flex-col gap-4`}
    >
      {!embedded && <BackLink href={returnHref} />}

      {!active && (
        <Alert>
          <EyeOffIcon aria-hidden />
          <AlertTitle>
            Cette offre n&rsquo;est pas visible des candidats
          </AlertTitle>
          <AlertDescription>{inactiveReason(offer, today)}</AlertDescription>
        </Alert>
      )}

      <OfferHero
        title={offer.title}
        companyName={companyName}
        details={details}
        action={
          !isAdmin ? (
            <SaveOfferButton
              offerId={offer.id}
              title={offer.title}
              saved={!!tracking?.savedAt}
              withLabel
            />
          ) : undefined
        }
      />
      <OfferSummary offer={details} />

      <div className={styles.detailLayout}>
        <aside className={styles.detailAside}>
          {application.status === "inactive" && (
            <HowToApply explanation={applicationModeExplanation(offer)} />
          )}
          {application.status !== "inactive" && (
            <ApplicationPanel
              offerId={offer.id}
              explanation={applicationModeExplanation(offer)}
              details={application}
              externalApplication={details.externalApplication}
              appliedAt={tracking?.appliedAt ?? null}
            />
          )}
        </aside>
        <OfferDetails offer={details} />
      </div>
      <footer className={styles.source}>
        <OfferProvenance
          offerId={offer.id}
          provenance={details.provenance}
          newness={details.newness}
          humanVerifiedAt={offer.humanVerifiedAt}
          companyName={companyName}
          validityConfirmedAt={offer.validityConfirmedAt}
          sourceCheckedAt={offer.sourceCheckedAt}
        />
      </footer>
    </div>
  )
}
