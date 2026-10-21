import {
  CircleAlertIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MailIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { site } from "@/config/site"
import { dossierRequirementLabels } from "@/domain/candidate-dossier"
import { cn } from "@/lib/utils"
import type { ApplicationDetails } from "@/server/offers/application"

import { AppliedButton } from "./tracking-buttons"

// « Comment postuler » : toujours visible, même sans dossier (§7).
export function HowToApply({ explanation }: { explanation: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3>Comment postuler</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>{explanation}</p>
        <p className="text-muted-foreground">
          Vous transmettez vous-même votre dossier ; {site.name} n&rsquo;envoie
          aucun document.
        </p>
      </CardContent>
    </Card>
  )
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="flex items-start gap-2 text-muted-foreground">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {what} indisponible
    </p>
  )
}

// Coordonnées de candidature, calculées côté serveur (getApplicationDetails) : un dossier incomplet
// ne reçoit que la liste de ce qui lui manque.
export function ApplicationPanel({
  offerId,
  details,
  appliedAt = null,
}: {
  offerId: string
  details: Exclude<ApplicationDetails, { status: "inactive" }>
  // Déclaration « J'ai postulé » du candidat (plan 12).
  appliedAt?: Date | null
}) {
  if (details.status === "incomplete") {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3>Candidater</h3>
          </CardTitle>
          <CardDescription>
            Complétez votre dossier pour voir les coordonnées du recruteur.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p>Il manque :</p>
            <ul className="list-disc pl-5">
              {details.missing.map((item) => (
                <li key={item}>{dossierRequirementLabels[item]}</li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg">
            <Link
              href={`/dossier?${new URLSearchParams({ retour: `/offres/${offerId}` })}`}
            >
              Compléter mon dossier
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { contacts, recruiter, forAdmin } = details
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3>Candidater</h3>
        </CardTitle>
        {forAdmin && (
          <CardDescription>
            Coordonnées visibles par l&rsquo;admin pour la modération.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recruiter && (
          <p className="flex items-start gap-2">
            <UserRoundIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {recruiter}
          </p>
        )}

        {contacts.email === "unavailable" ? (
          <Unavailable what="Adresse email" />
        ) : (
          contacts.email && (
            <a
              href={contacts.email.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-auto min-h-9 justify-start py-2 break-all",
              )}
            >
              <MailIcon data-icon="inline-start" aria-hidden />
              {contacts.email.label}
            </a>
          )
        )}
        {contacts.phone && (
          <a
            href={contacts.phone.href}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "justify-start",
            )}
          >
            <PhoneIcon data-icon="inline-start" aria-hidden />
            {contacts.phone.label}
          </a>
        )}
        {contacts.url === "unavailable" ? (
          <Unavailable what="Lien" />
        ) : (
          contacts.url && (
            <a
              href={contacts.url.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "justify-start",
              )}
            >
              <ExternalLinkIcon data-icon="inline-start" aria-hidden />
              Site officiel : {contacts.url.domain}
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          )
        )}

        {!forAdmin && (
          <>
            <a
              href="/api/dossier/documents/cv"
              download
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Télécharger mon CV
            </a>
            <p className="text-sm text-muted-foreground">
              Joignez vous-même votre CV : {site.name} ne l&rsquo;envoie jamais
              à votre place.
            </p>
            {/* Un clic sur un contact n'est pas une candidature : le candidat la déclare. */}
            <AppliedButton offerId={offerId} appliedAt={appliedAt} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
