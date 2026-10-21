import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  dossierRequirementLabels,
  type DossierRequirement,
} from "@/domain/candidate-dossier"

const listFormat = new Intl.ListFormat("fr-FR", { type: "conjunction" })

export function missingLabel(missing: DossierRequirement[]) {
  return listFormat.format(
    missing.map((item) => dossierRequirementLabels[item]),
  )
}

// Bannière de /offres : un dossier incomplet n'empêche pas de rechercher, seulement de candidater.
export function DossierBanner({ missing }: { missing: DossierRequirement[] }) {
  if (missing.length === 0) return null

  return (
    <Alert>
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Complétez votre dossier pour pouvoir candidater</AlertTitle>
      <AlertDescription>Il manque {missingLabel(missing)}.</AlertDescription>
      <div className="col-start-2 mt-2">
        <Button asChild size="lg">
          <Link href="/dossier">Compléter mon dossier</Link>
        </Button>
      </div>
    </Alert>
  )
}

// En tête de /dossier : ce qui manque encore pour candidater.
export function DossierStatus({ missing }: { missing: DossierRequirement[] }) {
  if (missing.length === 0) {
    return (
      <Alert role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>Votre dossier est complet</AlertTitle>
        <AlertDescription>
          Les coordonnées des recruteurs s&rsquo;affichent sur chaque offre.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert role="status">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Dossier incomplet</AlertTitle>
      <AlertDescription>
        Pour candidater, ajoutez {missingLabel(missing)}. Vous pouvez rechercher
        des offres sans attendre.
      </AlertDescription>
    </Alert>
  )
}
