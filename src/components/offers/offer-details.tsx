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
] as const satisfies readonly (keyof Offer)[]

// L'aperçu du dépôt (plan 14) montre aussi une saisie incomplète : saison et département peuvent
// encore manquer. Une offre enregistrée a toujours les deux.
export type OfferDetailsData = Omit<
  Pick<Offer, (typeof offerDetailsFields)[number]>,
  "season"
> & {
  season: Offer["season"] | null
  occupationLabel: string | null
  department: { code: string; name: string } | null
  regionName: string | null
}

type OfferDetailsSource = Pick<Offer, (typeof offerDetailsFields)[number]> & {
  occupation: { label: string } | null
  department: { code: string; name: string; region?: { name: string } | null }
}

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
}: {
  value: TriState
  details?: string | null
}) {
  return (
    <>
      <InfoValue value={value} />
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

      <Section title="Lieu">
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
      </Section>

      <Section title="Rémunération">
        <Row label="Salaire">
          {salary ? (
            formatSalary(salary)
          ) : (
            <NotSpecified>Salaire non précisé</NotSpecified>
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
          <Answer value={offer.housing} details={offer.housingDetails} />
        </Row>
        <Row label="Repas fournis">
          <Answer value={offer.meals} details={offer.mealsDetails} />
        </Row>
      </Section>

      <Section title="Profil">
        <Row label="Expérience exigée">
          <Answer
            value={offer.experienceRequired}
            details={offer.experienceDetails}
          />
        </Row>
        <Row label="Langues exigées">
          <InfoValue value={offer.languagesRequired} />
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
          />
        </Row>
      </Section>

      <Section title="Organisation">
        <Row label="Temps de travail">
          {offer.workTime === "unknown" ? (
            <NotSpecified />
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
          <InfoValue value={offer.couplesWelcome} />
        </Row>
        <Row label="Animaux acceptés">
          <InfoValue value={offer.petsAllowed} />
        </Row>
        <Row label="Autres contraintes">
          <Text value={offer.otherConstraints} />
        </Row>
      </Section>
    </div>
  )
}
