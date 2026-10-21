import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type inferParserType,
  type LoaderInput,
  type UrlKeys,
} from "nuqs/server"

import { isIsoDate } from "@/domain/offer-activity"
import type { SalaryBasis } from "@/domain/salary"
import {
  searchCriteriaSchema,
  type SearchCriteria,
  type SearchWorkTime,
} from "@/domain/search-criteria"

// Paramètres d'URL de /offres. L'URL est la seule source de vérité : un rechargement ou un lien
// partagé redonne la même recherche. Les mêmes parseurs servent à la page (createLoader) et aux
// filtres (useQueryStates de nuqs) : ce module ne dépend ni de la base ni du serveur.

// Valeur d'URL française ↔ valeur du code, pour une liste fermée.
function literal<T extends string>(fromUrl: Record<string, T>) {
  const toUrl = Object.fromEntries(
    Object.entries(fromUrl).map(([query, value]) => [value, query]),
  ) as Record<T, string>
  return createParser<T>({
    parse: (query) => (Object.hasOwn(fromUrl, query) ? fromUrl[query] : null),
    serialize: (value) => toUrl[value],
  })
}

// Interrupteur : « oui » quand il est actif, absent de l'URL sinon.
const flag = createParser<boolean>({
  parse: (query) => (query === "oui" ? true : null),
  serialize: (value) => (value ? "oui" : "non"),
}).withDefault(false)

const isoDate = createParser<string>({
  parse: (query) => (isIsoDate(query) ? query : null),
  serialize: (value) => value,
})

const list = parseAsArrayOf(parseAsString).withDefault([])

export const searchParsers = {
  occupations: list,
  regions: list,
  departments: list,
  availableFrom: isoDate,
  availableTo: isoDate,
  flexibleDates: flag,
  salaryBasis: literal<SalaryBasis>({ net: "net", brut: "gross" }),
  salaryMinMonthly: parseAsInteger,
  housing: flag,
  meals: flag,
  beginnersWelcome: flag,
  spokenLanguages: list,
  workTime: literal<SearchWorkTime>({
    plein: "full_time",
    partiel: "part_time",
  }),
  noLicenseRequired: flag,
  couplesWelcome: flag,
  petsAllowed: flag,
  page: parseAsInteger.withDefault(1),
}

// Clés courtes, en français : /offres?metier=serveur,plongeur&dept=73&base=net&min=1800
export const searchUrlKeys: UrlKeys<typeof searchParsers> = {
  occupations: "metier",
  regions: "region",
  departments: "dept",
  availableFrom: "du",
  availableTo: "au",
  flexibleDates: "flexible",
  salaryBasis: "base",
  salaryMinMonthly: "min",
  housing: "logement",
  meals: "repas",
  beginnersWelcome: "debutant",
  spokenLanguages: "langues",
  workTime: "temps",
  noLicenseRequired: "sanspermis",
  couplesWelcome: "couple",
  petsAllowed: "animaux",
  page: "page",
}

// État des filtres tel que nuqs le lit dans l'URL : null, false ou [] pour un critère inactif.
export type SearchValues = inferParserType<typeof searchParsers>
export type FilterValues = Omit<SearchValues, "page">

type CriteriaField = keyof typeof searchCriteriaSchema.shape

// Critères valides tirés de l'URL. Une URL modifiée à la main ne fait pas échouer la page : une
// valeur invalide est ignorée, et seulement elle.
export function criteriaFromValues(values: FilterValues): SearchCriteria {
  const shape = searchCriteriaSchema.shape
  const accepts = (field: CriteriaField, value: unknown) =>
    shape[field].safeParse(value).success

  const criteria: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(values) as [
    CriteriaField,
    FilterValues[CriteriaField],
  ][]) {
    if (value === null || value === false) continue
    if (Array.isArray(value)) {
      const items = [...new Set(value)].filter((item) => accepts(field, [item]))
      if (items.length > 0 && accepts(field, items)) criteria[field] = items
    } else if (accepts(field, value)) {
      criteria[field] = value
    }
  }

  // Règles entre critères : une fin de disponibilité antérieure au début est ignorée, comme un
  // minimum de salaire sans base (H5).
  const { availableFrom, availableTo } = criteria as SearchCriteria
  if (availableFrom && availableTo && availableTo < availableFrom) {
    delete criteria.availableTo
  }
  if (criteria.salaryMinMonthly !== undefined && !criteria.salaryBasis) {
    delete criteria.salaryMinMonthly
  }
  return searchCriteriaSchema.parse(criteria)
}

// L'inverse : l'état des filtres qui correspond à ces critères.
export function valuesFromCriteria(criteria: SearchCriteria): FilterValues {
  return {
    occupations: criteria.occupations ?? [],
    regions: criteria.regions ?? [],
    departments: criteria.departments ?? [],
    availableFrom: criteria.availableFrom ?? null,
    availableTo: criteria.availableTo ?? null,
    flexibleDates: criteria.flexibleDates ?? false,
    salaryBasis: criteria.salaryBasis ?? null,
    salaryMinMonthly: criteria.salaryMinMonthly ?? null,
    housing: criteria.housing ?? false,
    meals: criteria.meals ?? false,
    beginnersWelcome: criteria.beginnersWelcome ?? false,
    spokenLanguages: criteria.spokenLanguages ?? [],
    workTime: criteria.workTime ?? null,
    noLicenseRequired: criteria.noLicenseRequired ?? false,
    couplesWelcome: criteria.couplesWelcome ?? false,
    petsAllowed: criteria.petsAllowed ?? false,
  }
}

const loadValues = createLoader(searchParsers, { urlKeys: searchUrlKeys })

// Ce que la page lit dans son URL : les critères et la page demandée (1 au minimum).
export function loadSearch(input: LoaderInput) {
  const { page, ...values } = loadValues(input)
  return { criteria: criteriaFromValues(values), page: Math.max(1, page) }
}

const serialize = createSerializer(searchParsers, { urlKeys: searchUrlKeys })

// Lien vers une page de résultats de la même recherche.
export function searchHref(criteria: SearchCriteria, page = 1) {
  return serialize("/offres", {
    ...valuesFromCriteria(criteria),
    page: page > 1 ? page : null,
  })
}
