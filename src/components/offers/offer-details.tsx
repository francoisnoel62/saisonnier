import { site } from "@/config/site"
import { languageLabel } from "@/domain/languages"
import {
  contractPeriod,
  formatIsoDate,
  seasonLabels,
  workTimeLabels,
} from "@/domain/offer-display"
import {
  displayedSalary,
  formatSalary,
  salaryStatements,
} from "@/domain/salary"
import type { TriState } from "@/domain/tri-state"
import type { Offer } from "@/lib/db/schema"
import { isToConfirm } from "@/domain/field-certainty"
import {
  offerPlaces,
  placesSummary,
  type OfferPlace,
  type PlaceSource,
} from "@/domain/offer-places"
import {
  provenanceOf,
  newnessOf,
  isExternalApplication,
  type Newness,
  type Provenance,
} from "@/domain/offer-labels"

import { InfoValue } from "./info-value"

// Champs de l'offre que la fiche affiche : ni contact, ni entreprise (son nom public est fourni à
// part). Le serveur ne transmet que ceux-là.
export const offerDetailsFields = [
  "description",
  "missions",
  "season",
  "startDate",
  "endDate",
  "durationValue",
  "durationUnit",
  "applicationDeadline",
  "communeName",
  "postalCode",
  "locationDetails",
  "salaryNetMinCents",
  "salaryNetMaxCents",
  "salaryNetUnit",
  "salaryGrossMinCents",
  "salaryGrossMaxCents",
  "salaryGrossUnit",
  "salaryNotes",
  "housing",
  "housingDetails",
  "meals",
  "mealsDetails",
  "experienceRequired",
  "experienceDetails",
  "languagesRequired",
  "languages",
  "drivingLicenseRequired",
  "drivingLicenseDetails",
  "workTime",
  "weeklyHours",
  "scheduleDetails",
  "couplesWelcome",
  "petsAllowed",
  "otherConstraints",
  "additionalInfo",
  "fieldsToConfirm",
] as const satisfies readonly (keyof Offer)[]

// L'aperçu du dépôt (plan 14) montre aussi une saisie incomplète : saison et département peuvent
// encore manquer. Le département enregistré est obligatoire ; été/hiver reste facultatif.
export type OfferDetailsData = Omit<
  Pick<Offer, (typeof offerDetailsFields)[number]>,
  "season"
> & {
  season: Offer["season"] | null
  occupationLabel: string | null
  department: { code: string; name: string } | null
  regionName: string | null
  provenance: Provenance
  newness: Newness | null
  externalApplication: boolean
  places: OfferPlace[]
}

type OfferDetailsSource = Pick<Offer, (typeof offerDetailsFields)[number]> & {
  occupation: { label: string } | null
  department: { code: string; name: string; region?: { name: string } | null }
  extraLocations?: (PlaceSource & { position: number })[]
  communeInseeCode?: string | null
} & Partial<
    Pick<
      Offer,
      | "origin"
      | "humanVerifiedAt"
      | "applicationChannel"
      | "applyEmail"
      | "applyPhone"
      | "applyUrl"
      | "sourcePublishedDate"
      | "sourcePublishedAt"
      | "firstDiscoveredAt"
      | "publishedAt"
    >
  > & { createdBy?: { role: string } | null }

// Une offre lue en base (getOfferWithRelations) → ce que la fiche affiche, et rien d'autre.
export function toOfferDetailsData(
  offer: OfferDetailsSource,
): OfferDetailsData {
  const fields = Object.fromEntries(
    offerDetailsFields.map((field) => [field, offer[field]]),
  ) as Pick<Offer, (typeof offerDetailsFields)[number]>
  return {
    ...fields,
    occupationLabel: offer.occupation?.label ?? null,
    department: { code: offer.department.code, name: offer.department.name },
    regionName: offer.department.region?.name ?? null,
    provenance: provenanceOf({ ...offer, origin: offer.origin ?? "deposited" }),
    newness: newnessOf(offer),
    externalApplication: isExternalApplication({
      ...offer,
      applicationChannel: offer.applicationChannel ?? "employer",
    }),
    places: offerPlaces(
      { ...offer, departmentCode: offer.department.code },
      offer.extraLocations,
    ),
  }
}

const hours = new Intl.NumberFormat(site.locale, { maximumFractionDigits: 1 })

function NotSpecified({ children = "Non précisé" }: { children?: string }) {
  return <span className="text-muted-foreground">{children}</span>
}

// Un texte absent vaut « Non précisé » : jamais masqué, jamais inventé.
function Text({ value }: { value: string | null | undefined }) {
  return value?.trim() ? (
    <span className="whitespace-pre-line">{value}</span>
  ) : (
    <NotSpecified />
  )
}

// Oui / Non / Non précisé, suivi des précisions de l'annonce s'il y en a.
function Answer({
  value,
  details,
  toConfirm,
}: {
  value: TriState
  details?: string | null
  toConfirm?: boolean
}) {
  return (
    <>
      <InfoValue value={value} toConfirm={toConfirm} />
      {details?.trim() && (
        <span className="block whitespace-pre-line text-muted-foreground">
          {details}
        </span>
      )}
    </>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-base font-semibold">{title}</h3>
      <dl className="divide-y">{children}</dl>
    </section>
  )
}

// Fiche d'une offre, purement présentationnelle : la page candidat, l'aperçu du dépôt (plan 14) et
// le back-office la réutilisent. Chaque information figure, même inconnue (§3, §9).
export function OfferDetails({ offer }: { offer: OfferDetailsData }) {
  const salary = displayedSalary(offer)
  // L'autre déclaration (net ou brut), dans son unité d'origine : rien n'est converti.
  const otherSalary =
    salary &&
    salaryStatements(offer).find(
      (statement) => statement.basis !== salary.basis,
    )

  return (
    <div className="flex flex-col gap-8">
      <Section title="Poste">
        <Row label="Métier">
          <Text value={offer.occupationLabel} />
        </Row>
        <Row label="Description">
          <Text value={offer.description} />
        </Row>
        <Row label="Missions">
          <Text value={offer.missions} />
        </Row>
      </Section>

      <Section title="Contrat">
        <Row label="Saison">
          {offer.season ? (
            seasonLabels[offer.season]
          ) : (
            <NotSpecified>Non précisée</NotSpecified>
          )}
        </Row>
        <Row label="Période">{contractPeriod(offer)}</Row>
        <Row label="Date limite de candidature">
          {offer.applicationDeadline ? (
            formatIsoDate(offer.applicationDeadline)
          ) : (
            <NotSpecified>Non précisée</NotSpecified>
          )}
        </Row>
      </Section>

      <Section title={offer.places.length > 1 ? "Lieux" : "Lieu"}>
        <Row label="Commune">
          {!offer.communeName.trim() ? (
            <NotSpecified>Non précisée</NotSpecified>
          ) : offer.postalCode ? (
            `${offer.communeName} (${offer.postalCode})`
          ) : (
            offer.communeName
          )}
        </Row>
        <Row label="Département">
          {offer.department ? (
            `${offer.department.name} (${offer.department.code})`
          ) : (
            <NotSpecified />
          )}
        </Row>
        <Row label="Région">
          <Text value={offer.regionName} />
        </Row>
        {offer.locationDetails?.trim() && (
          <Row label="Précisions">
            <Text value={offer.locationDetails} />
          </Row>
        )}
        {offer.places.slice(1).map((place, index) => (
          <Row key={index} label={`Autre lieu ${index + 1}`}>
            <p>{placesSummary([place])}</p>
            {place.postalCode && <p>Code postal : {place.postalCode}</p>}
            {place.regionName && (
              <p className="text-muted-foreground">{place.regionName}</p>
            )}
            {place.locationDetails && (
              <p className="whitespace-pre-line">{place.locationDetails}</p>
            )}
          </Row>
        ))}
      </Section>

      <Section title="Rémunération">
        <Row label="Salaire">
          {salary ? (
            formatSalary(salary)
          ) : (
            <NotSpecified>
              {isToConfirm(offer, "salary")
                ? "Salaire à confirmer"
                : "Salaire non précisé"}
            </NotSpecified>
          )}
        </Row>
        {otherSalary && (
          <Row label="Également indiqué">{formatSalary(otherSalary)}</Row>
        )}
        {offer.salaryNotes?.trim() && (
          <Row label="Précisions">
            <Text value={offer.salaryNotes} />
          </Row>
        )}
      </Section>

      <Section title="Conditions">
        <Row label="Logement fourni">
          <Answer
            value={offer.housing}
            details={offer.housingDetails}
            toConfirm={isToConfirm(offer, "housing")}
          />
        </Row>
        <Row label="Repas fournis">
          <Answer
            value={offer.meals}
            details={offer.mealsDetails}
            toConfirm={isToConfirm(offer, "meals")}
          />
        </Row>
      </Section>

      <Section title="Profil">
        <Row label="Expérience exigée">
          <Answer
            value={offer.experienceRequired}
            details={offer.experienceDetails}
            toConfirm={isToConfirm(offer, "experience")}
          />
        </Row>
        <Row label="Langues exigées">
          <InfoValue
            value={offer.languagesRequired}
            toConfirm={isToConfirm(offer, "languages")}
          />
          {offer.languagesRequired === "yes" && offer.languages.length > 0 && (
            <span className="block">
              {offer.languages.map(languageLabel).join(", ")}
            </span>
          )}
        </Row>
        <Row label="Permis de conduire exigé">
          <Answer
            value={offer.drivingLicenseRequired}
            details={offer.drivingLicenseDetails}
            toConfirm={isToConfirm(offer, "driving_license")}
          />
        </Row>
      </Section>

      <Section title="Organisation">
        <Row label="Temps de travail">
          {offer.workTime === "unknown" ? (
            <InfoValue
              value="unknown"
              toConfirm={isToConfirm(offer, "work_time")}
            />
          ) : (
            workTimeLabels[offer.workTime]
          )}
        </Row>
        <Row label="Heures par semaine">
          {offer.weeklyHours ? (
            `${hours.format(offer.weeklyHours)} h`
          ) : (
            <NotSpecified />
          )}
        </Row>
        <Row label="Horaires">
          <Text value={offer.scheduleDetails} />
        </Row>
      </Section>

      <Section title="Vie pratique">
        <Row label="Couples acceptés">
          <InfoValue
            value={offer.couplesWelcome}
            toConfirm={isToConfirm(offer, "couples")}
          />
        </Row>
        <Row label="Animaux acceptés">
          <InfoValue
            value={offer.petsAllowed}
            toConfirm={isToConfirm(offer, "pets")}
          />
        </Row>
        <Row label="Autres contraintes">
          <Text value={offer.otherConstraints} />
        </Row>
      </Section>
      {offer.additionalInfo && (
        <Section title="Divers">
          <Row label="Précisions">
            <Text value={offer.additionalInfo} />
          </Row>
        </Section>
      )}
    </div>
  )
}
