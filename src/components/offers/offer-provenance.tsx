import { BadgeCheckIcon, GlobeIcon } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  newnessLabel,
  provenanceLabels,
  type Newness,
  type Provenance,
} from "@/domain/offer-labels"
import { formatDate } from "@/lib/format"

export function OfferProvenance({
  offerId,
  provenance,
  companyName,
  humanVerifiedAt,
  validityConfirmedAt,
  sourceCheckedAt,
  newness,
}: {
  offerId: string
  provenance: Provenance
  companyName: string
  humanVerifiedAt: Date | null
  validityConfirmedAt: Date | null
  sourceCheckedAt: Date | null
  newness: Newness | null
}) {
  const collected = provenance === "human_verified" || provenance === "sourced"
  const Icon = collected ? GlobeIcon : BadgeCheckIcon
  const text =
    provenance === "human_verified"
      ? `Annonce reprise du site officiel de ${companyName}, vérifiée par l'équipe${humanVerifiedAt ? ` le ${formatDate(humanVerifiedAt)}` : ""}`
      : provenance === "sourced"
        ? `Annonce sourcée sur internet depuis le site officiel de ${companyName}, sans vérification humaine`
        : provenance === "verified_recruiter"
          ? "Annonce déposée par un recruteur vérifié"
          : "Annonce déposée par l'employeur"
  return (
    <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
      <Badge variant="outline">{provenanceLabels[provenance]}</Badge>
      <p className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{text}</span>
      </p>
      {newness && <p>{newnessLabel(newness)}</p>}
      {collected && sourceCheckedAt && (
        <p>Source consultée le {formatDate(sourceCheckedAt)}</p>
      )}
      {!collected && validityConfirmedAt && (
        <p>Validité confirmée le {formatDate(validityConfirmedAt)}</p>
      )}
      {collected && (
        <Link
          href={`/contact?motif=annonce-collectee&offre=${offerId}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Vous êtes l&rsquo;employeur ? Pour compléter, corriger ou retirer
          cette annonce, contactez-nous
        </Link>
      )}
    </div>
  )
}
