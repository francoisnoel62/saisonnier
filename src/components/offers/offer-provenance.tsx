import { BadgeCheckIcon, GlobeIcon } from "lucide-react"
import Link from "next/link"

import type { OfferOrigin } from "@/domain/offer"
import { formatDate } from "@/lib/format"

// Provenance d'une annonce (§6). Une annonce collectée n'a pas été confirmée par le recruteur :
// aucune formulation ne doit le laisser croire. Ses corrections passent par le fondateur.
export function OfferProvenance({
  offerId,
  origin,
  companyName,
  validityConfirmedAt,
  sourceCheckedAt,
}: {
  offerId: string
  origin: OfferOrigin
  companyName: string
  validityConfirmedAt: Date | null
  sourceCheckedAt: Date | null
}) {
  if (origin === "deposited") {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <BadgeCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Annonce déposée par l&rsquo;employeur
          {validityConfirmedAt &&
            ` · Validité confirmée le ${formatDate(validityConfirmedAt)}`}
        </span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p className="flex items-start gap-2">
        <GlobeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Annonce publiée sur le site officiel de {companyName}
          {sourceCheckedAt &&
            ` — source consultée le ${formatDate(sourceCheckedAt)}`}
        </span>
      </p>
      <p className="pl-6">
        <Link
          href={`/contact?motif=annonce-collectee&offre=${offerId}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Vous êtes l&rsquo;employeur ? Pour compléter, corriger ou retirer
          cette annonce, contactez-nous
        </Link>
      </p>
    </div>
  )
}
