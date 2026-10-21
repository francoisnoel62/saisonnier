import type { WorkTime } from "./offer"
import { isActive, type ActivityFields } from "./offer-activity"
import { salaryStatements, type SalaryFields } from "./salary"
import type { SearchCriteria } from "./search-criteria"
import type { TriState } from "./tri-state"

// Correspondance entre une offre et les critères de recherche (§4, H4 à H8), en mémoire. C'est la
// spécification exécutable de la recherche : la requête SQL (src/server/search/) doit retenir
// exactement les mêmes offres. Règle transversale : `unknown` ne satisfait jamais un critère actif.

// Un champ absent vaut sa valeur par défaut en base : « Non précisé », aucune langue.
export type MatchableOffer = ActivityFields &
  SalaryFields & {
    occupationSlug: string | null
    departmentCode: string
    // Région du département de l'offre.
    regionCode: string
    startDate?: string | null
    endDate?: string | null
    housing?: TriState
    meals?: TriState
    experienceRequired?: TriState
    languagesRequired?: TriState
    languages?: string[]
    drivingLicenseRequired?: TriState
    workTime?: WorkTime
    couplesWelcome?: TriState
    petsAllowed?: TriState
  }

type Rule = (offer: MatchableOffer, criteria: SearchCriteria) => boolean

const selected = (values: readonly string[] | undefined): values is string[] =>
  values !== undefined && values.length > 0

// Une offre sans métier n'appartient à aucun métier choisi.
const occupation: Rule = (offer, { occupations }) =>
  !selected(occupations) ||
  (offer.occupationSlug !== null && occupations.includes(offer.occupationSlug))

// Le département de l'offre est choisi, ou sa région l'est.
const location: Rule = (offer, { regions, departments }) =>
  (!selected(regions) && !selected(departments)) ||
  (departments ?? []).includes(offer.departmentCode) ||
  (regions ?? []).includes(offer.regionCode)

// H4 : en mode strict, le contrat tient dans la disponibilité ; en mode flexible, il la chevauche.
// Une borne seule s'applique seule. Sans dates précises (durée seule), l'offre est exclue.
const dates: Rule = (
  offer,
  { availableFrom: from, availableTo: to, flexibleDates },
) => {
  if (!from && !to) return true
  const { startDate: start, endDate: end } = offer
  if (!start || !end) return false
  if (flexibleDates) return (!to || start <= to) && (!from || end >= from)
  return (!from || start >= from) && (!to || end <= to)
}

// H5 : seule compte la déclaration de la base choisie, en mensuel, par sa borne basse. Un brut
// n'est jamais comparé à un seuil net ; un salaire horaire ou journalier ne se compare pas.
const salary: Rule = (offer, { salaryBasis, salaryMinMonthly }) => {
  if (salaryMinMonthly === undefined || !salaryBasis) return true
  const statement = salaryStatements(offer).find((s) => s.basis === salaryBasis)
  return (
    statement?.unit === "month" && statement.minCents >= salaryMinMonthly * 100
  )
}

// H6 : aucune langue exigée, ou toutes les langues exigées sont parlées.
const languages: Rule = (offer, { spokenLanguages }) => {
  if (!selected(spokenLanguages)) return true
  if (offer.languagesRequired === "no") return true
  return (
    offer.languagesRequired === "yes" &&
    (offer.languages ?? []).every((code) => spokenLanguages.includes(code))
  )
}

// H7 : temps plein ou partiel, à l'identique.
const workTime: Rule = (offer, criteria) =>
  !criteria.workTime || offer.workTime === criteria.workTime

type Switch =
  | "housing"
  | "meals"
  | "beginnersWelcome"
  | "noLicenseRequired"
  | "couplesWelcome"
  | "petsAllowed"
type TriStateField =
  | "housing"
  | "meals"
  | "experienceRequired"
  | "drivingLicenseRequired"
  | "couplesWelcome"
  | "petsAllowed"

// Un interrupteur actif exige une réponse précise de l'offre.
const required =
  (flag: Switch, field: TriStateField, answer: TriState): Rule =>
  (offer, criteria) =>
    !criteria[flag] || offer[field] === answer

const rules: Rule[] = [
  occupation,
  location,
  dates,
  salary,
  required("housing", "housing", "yes"),
  required("meals", "meals", "yes"),
  // H8 : « Débutants acceptés », « Permis non exigé ».
  required("beginnersWelcome", "experienceRequired", "no"),
  languages,
  workTime,
  required("noLicenseRequired", "drivingLicenseRequired", "no"),
  required("couplesWelcome", "couplesWelcome", "yes"),
  required("petsAllowed", "petsAllowed", "yes"),
]

// L'offre est visible des candidats au jour `today` et satisfait tous les critères.
export function matchesCriteria(
  offer: MatchableOffer,
  criteria: SearchCriteria,
  today: string,
) {
  return isActive(offer, today) && rules.every((rule) => rule(offer, criteria))
}
