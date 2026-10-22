"use client"

import { BadgeCheckIcon, CircleAlertIcon, XIcon } from "lucide-react"

import { HowToApply } from "@/components/offers/application-panel"
import {
  OfferDetails,
  type OfferDetailsData,
} from "@/components/offers/offer-details"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { seasonLabels } from "@/domain/offer-display"

// Ce que voit un candidat : l'en-tête et la fiche (OfferDetails, plan 11), plus les coordonnées
// de candidature, que la fiche ne montre qu'aux dossiers complets (H3).
export type OfferPreviewData = {
  title: string
  companyName: string
  details: OfferDetailsData
  applicationExplanation: string
  contacts: { email: string | null; phone: string | null; url: string | null }
}

function Contacts({ contacts }: { contacts: OfferPreviewData["contacts"] }) {
  const rows: [string, string | null][] = [
    ["Email", contacts.email],
    ["Téléphone", contacts.phone],
    ["Lien officiel", contacts.url],
  ]
  return (
    <section className="flex flex-col gap-1 rounded-lg border p-4">
      <h3 className="text-base font-semibold">Coordonnées de candidature</h3>
      <p className="text-muted-foreground">
        Visibles des candidats dont le dossier est complet.
      </p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium">{label}</dt>
            <dd className="mb-2 break-words sm:mb-0">
              {value ?? (
                <span className="text-muted-foreground">Non renseigné</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function OfferPreview({
  preview,
  missing = [],
}: {
  preview: OfferPreviewData
  // Éléments du minimum encore manquants (aperçu d'une saisie en cours).
  missing?: string[]
}) {
  const { details } = preview
  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && (
        <Alert>
          <CircleAlertIcon aria-hidden />
          <AlertTitle>Pas encore publiable</AlertTitle>
          <AlertDescription>
            <p>Il manque :</p>
            <ul className="list-disc pl-5">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <header className="flex flex-col gap-2">
        {details.season && (
          <Badge variant="secondary">{seasonLabels[details.season]}</Badge>
        )}
        <h2 className="text-2xl font-semibold tracking-tight break-words">
          {preview.title || (
            <span className="text-muted-foreground">Intitulé à préciser</span>
          )}
        </h2>
        <p className="text-lg text-muted-foreground">{preview.companyName}</p>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <BadgeCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Annonce déposée par l&rsquo;employeur
        </p>
      </header>

      <HowToApply explanation={preview.applicationExplanation} />
      <Contacts contacts={preview.contacts} />
      <OfferDetails offer={details} />
    </div>
  )
}

// Aperçu dans un panneau latéral ; son contenu n'est rendu qu'à l'ouverture. Ouvert sans
// déclencheur (depuis un menu), il rend le focus par `onCloseAutoFocus`.
export function OfferPreviewSheet({
  trigger,
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
}: {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
  children: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="right"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="flex-row items-center justify-between border-b">
          <SheetTitle>Aperçu candidat</SheetTitle>
          <SheetDescription className="sr-only">
            L&rsquo;annonce telle que la verront les candidats.
          </SheetDescription>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-lg" aria-label="Fermer">
              <XIcon />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
