import { CircleAlertIcon, ClockIcon } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { MembershipStatus } from "@/domain/membership"

// Statut du rattachement, en tête des pages employeur. Rien une fois vérifié.
export function MembershipBanner({
  status,
  reviewNote,
}: {
  status: MembershipStatus
  reviewNote: string | null
}) {
  if (status === "pending") {
    return (
      <Alert role="status">
        <ClockIcon aria-hidden />
        <AlertTitle>Rattachement en cours de vérification</AlertTitle>
        <AlertDescription>
          Votre rattachement est en cours de vérification. Vos annonces seront
          publiées après validation.
        </AlertDescription>
      </Alert>
    )
  }
  if (status === "rejected") {
    return (
      <Alert variant="destructive" role="status">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>Rattachement refusé</AlertTitle>
        <AlertDescription>
          <p>
            Nous n&rsquo;avons pas pu vérifier votre lien avec cette entreprise
            : vos annonces ne seront pas publiées.
          </p>
          {reviewNote && <p>Motif : {reviewNote}</p>}
          <p>
            Une erreur ?{" "}
            <Link
              href="/contact?motif=employeur"
              className="underline underline-offset-4"
            >
              Contactez-nous
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  return null
}
