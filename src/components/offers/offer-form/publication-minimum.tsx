"use client"

import { CircleAlertIcon, CircleCheckIcon, CircleIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { OfferOrigin } from "@/domain/offer"
import type { MinimumRequirement, MissingItem } from "@/domain/offer-minimum"

type Requirement = { requirement: MinimumRequirement; label: string }

// Les cinq éléments du minimum (§3), dans l'ordre du formulaire. Une annonce collectée peut se
// candidater par son lien officiel ; le canal « chargé de recrutement » le nomme (plan 15).
function requirementsFor(origin: OfferOrigin, recruiter: boolean) {
  const requirements: Requirement[] = [
    { requirement: "company", label: "Une entreprise identifiable" },
    {
      requirement: "seasonal_contract",
      label: "Un contrat saisonnier : case cochée et saison choisie",
    },
    { requirement: "location", label: "Un lieu précis : la commune" },
    {
      requirement: "period",
      label: "Des dates de début et de fin, ou une durée",
    },
    {
      requirement: "application",
      label:
        origin === "collected"
          ? "Un moyen de candidature : email, téléphone ou lien officiel"
          : "Un contact direct : email ou téléphone",
    },
  ]
  if (recruiter) {
    requirements.push({
      requirement: "recruiter",
      label: "Le nom du chargé de recrutement",
    })
  }
  return requirements
}

// Encart « Minimum de publication », mis à jour à chaque saisie (checkPublicationMinimum).
export function PublicationMinimum({
  missing,
  origin = "deposited",
  recruiter = false,
}: {
  missing: MissingItem[]
  origin?: OfferOrigin
  recruiter?: boolean
}) {
  const requirements = requirementsFor(origin, recruiter)
  const isMissing = (requirement: MinimumRequirement) =>
    missing.some((item) => item.requirement === requirement)
  const blocked = missing.filter(
    (item) => item.requirement === "blocked_domain",
  )
  const count = requirements.filter(({ requirement }) =>
    isMissing(requirement),
  ).length

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>Minimum de publication</h2>
        </CardTitle>
        <CardDescription>
          Seuls ces éléments sont obligatoires. Tout le reste est facultatif :
          une information laissée vide s&rsquo;affiche «&nbsp;Non
          précisé&nbsp;», jamais «&nbsp;Non&nbsp;».
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {requirements.map(({ requirement, label }) => {
            const done = !isMissing(requirement)
            return (
              <li
                key={requirement}
                data-done={done}
                className="flex items-start gap-2"
              >
                {done ? (
                  <CircleCheckIcon
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                ) : (
                  <CircleIcon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className={done ? undefined : "text-muted-foreground"}>
                  {label}
                  <span className="sr-only">
                    {done ? " : fait" : " : à compléter"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
        {blocked.map((item) => (
          <p
            key={item.label}
            className="flex items-start gap-2 text-destructive"
          >
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {item.label}
          </p>
        ))}
        <p aria-live="polite" className="font-medium">
          {missing.length === 0
            ? "Le minimum est atteint."
            : count === 0
              ? "Corrigez la destination de candidature."
              : `Il manque ${count} élément${count > 1 ? "s" : ""}.`}
        </p>
      </CardContent>
    </Card>
  )
}
