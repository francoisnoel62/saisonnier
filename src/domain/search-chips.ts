import { site } from "@/config/site"

import { languageLabel } from "./languages"
import { formatIsoDate, workTimeLabels } from "./offer-display"
import { salaryBasisLabels } from "./salary"
import type { SearchCriteria } from "./search-criteria"

// Critères actifs de la recherche (§4) : chacun est visible et se retire seul.

// Libellés des référentiels, pour nommer les critères.
export type SearchReferentials = {
  occupations: { slug: string; label: string; family: string }[]
  regions: { code: string; name: string }[]
  departments: { code: string; name: string; regionCode: string }[]
}

// Interrupteurs de la recherche, dans l'ordre des filtres.
export type SearchSwitch =
  | "housing"
  | "meals"
  | "beginnersWelcome"
  | "noLicenseRequired"
  | "couplesWelcome"
  | "petsAllowed"

export const searchSwitchLabels: Record<SearchSwitch, string> = {
  housing: "Logement fourni",
  meals: "Repas fournis",
  beginnersWelcome: "Débutants acceptés",
  noLicenseRequired: "Permis non exigé",
  couplesWelcome: "Couples acceptés",
  petsAllowed: "Animaux acceptés",
}

export type CriteriaChip = {
  // Unique dans la liste.
  key: string
  label: string
  // Les critères une fois celui-ci retiré : tous les autres restent.
  without: SearchCriteria
}

type ListField = "occupations" | "regions" | "departments" | "spokenLanguages"

const euros = new Intl.NumberFormat(site.locale)

// Un badge par critère actif, dans l'ordre des filtres. Un critère sans effet (une base de salaire
// sans minimum, des dates flexibles sans dates) n'a pas de badge.
export function activeCriteriaChips(
  criteria: SearchCriteria,
  referentials: SearchReferentials,
): CriteriaChip[] {
  const chips: CriteriaChip[] = []

  const omit = (...fields: (keyof SearchCriteria)[]) => {
    const rest = { ...criteria }
    for (const field of fields) delete rest[field]
    return rest
  }
  const withoutItem = (field: ListField, value: string) => {
    const rest = (criteria[field] ?? []).filter((item) => item !== value)
    return rest.length > 0 ? { ...criteria, [field]: rest } : omit(field)
  }
  const addItems = (field: ListField, label: (value: string) => string) => {
    for (const value of criteria[field] ?? []) {
      chips.push({
        key: `${field}:${value}`,
        label: label(value),
        without: withoutItem(field, value),
      })
    }
  }

  const occupations = new Map(
    referentials.occupations.map((o) => [o.slug, o.label]),
  )
  const regions = new Map(referentials.regions.map((r) => [r.code, r.name]))
  const departments = new Map(
    referentials.departments.map((d) => [d.code, d.name]),
  )

  // Une valeur absente du référentiel (lien ancien) reste affichée telle quelle.
  addItems("occupations", (slug) => occupations.get(slug) ?? slug)
  addItems("regions", (code) => regions.get(code) ?? `Région ${code}`)
  addItems("departments", (code) => {
    const name = departments.get(code)
    return name ? `${name} (${code})` : `Département ${code}`
  })

  const { availableFrom: from, availableTo: to } = criteria
  if (from || to) {
    const period =
      from && to
        ? `Disponible du ${formatIsoDate(from)} au ${formatIsoDate(to)}`
        : from
          ? `Disponible à partir du ${formatIsoDate(from)}`
          : `Disponible jusqu'au ${formatIsoDate(to!)}`
    chips.push({
      key: "dates",
      label: criteria.flexibleDates ? `${period} (dates flexibles)` : period,
      without: omit("availableFrom", "availableTo", "flexibleDates"),
    })
  }

  if (criteria.salaryMinMonthly !== undefined && criteria.salaryBasis) {
    chips.push({
      key: "salary",
      label: `Salaire ${salaryBasisLabels[criteria.salaryBasis]} d'au moins ${euros.format(criteria.salaryMinMonthly)}\u00a0€ / mois`,
      without: omit("salaryBasis", "salaryMinMonthly"),
    })
  }

  const addSwitch = (field: SearchSwitch) => {
    if (criteria[field]) {
      chips.push({
        key: field,
        label: searchSwitchLabels[field],
        without: omit(field),
      })
    }
  }

  // Conditions, profil, organisation, vie pratique : l'ordre des filtres.
  addSwitch("housing")
  addSwitch("meals")
  addSwitch("beginnersWelcome")
  addItems(
    "spokenLanguages",
    (code) => `Je parle ${languageLabel(code).toLocaleLowerCase(site.locale)}`,
  )
  addSwitch("noLicenseRequired")
  if (criteria.workTime) {
    chips.push({
      key: "workTime",
      label: workTimeLabels[criteria.workTime],
      without: omit("workTime"),
    })
  }
  addSwitch("couplesWelcome")
  addSwitch("petsAllowed")

  return chips
}
