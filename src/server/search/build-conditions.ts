import {
  and,
  arrayContained,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  exists,
  sql,
  type SQL,
} from "drizzle-orm"

import type { SearchCriteria } from "@/domain/search-criteria"
import { db } from "@/lib/db"
import {
  departments,
  occupations,
  offers,
  offerLocations,
} from "@/lib/db/schema"
import { activeOfferConditions } from "@/server/offers/queries"

// Critères de recherche → SQL : une fonction par critère, chacune renvoyant `undefined` quand le
// critère est inactif. Même règles, critère par critère, que src/domain/offer-matching.ts.
// `unknown` n'est jamais retenu : chaque condition exige une valeur précise.

type Condition = (criteria: SearchCriteria) => SQL | undefined

const selected = (values: readonly string[] | undefined): values is string[] =>
  values !== undefined && values.length > 0

// Une offre sans métier (occupation_id null) n'est dans aucune liste.
const occupation: Condition = ({ occupations: slugs }) =>
  selected(slugs)
    ? inArray(
        offers.occupationId,
        db
          .select({ id: occupations.id })
          .from(occupations)
          .where(inArray(occupations.slug, slugs)),
      )
    : undefined

// Le département de l'offre est choisi, ou sa région l'est.
const location: Condition = ({ regions, departments: codes }) => {
  if (!selected(regions) && !selected(codes)) return undefined
  const selectedDepartment = (
    column: typeof offers.departmentCode | typeof offerLocations.departmentCode,
  ) =>
    or(
      selected(codes) ? inArray(column, codes) : undefined,
      selected(regions)
        ? inArray(
            column,
            db
              .select({ code: departments.code })
              .from(departments)
              .where(inArray(departments.regionCode, regions)),
          )
        : undefined,
    )
  return or(
    selectedDepartment(offers.departmentCode),
    // Garder l'identité externe qualifiée, y compris dans les count mono-table de Drizzle.
    exists(
      db
        .select({ id: offerLocations.id })
        .from(offerLocations)
        .where(
          and(
            eq(offerLocations.offerId, sql`"offers"."id"`),
            selectedDepartment(offerLocations.departmentCode),
          ),
        ),
    ),
  )
}

// H4 : contrat inclus dans la disponibilité, ou qui la chevauche en mode flexible. Les deux
// dates de l'offre sont exigées : une durée seule ne se compare pas.
const dates: Condition = ({
  availableFrom: from,
  availableTo: to,
  flexibleDates,
}) => {
  if (!from && !to) return undefined
  return and(
    isNotNull(offers.startDate),
    isNotNull(offers.endDate),
    flexibleDates
      ? and(
          to ? lte(offers.startDate, to) : undefined,
          from ? gte(offers.endDate, from) : undefined,
        )
      : and(
          from ? gte(offers.startDate, from) : undefined,
          to ? lte(offers.endDate, to) : undefined,
        ),
  )
}

// H5 : la base choisie seule, en mensuel, par sa borne basse ; un brut ne répond jamais à un
// seuil net.
const salary: Condition = ({ salaryBasis, salaryMinMonthly }) => {
  if (salaryMinMonthly === undefined || !salaryBasis) return undefined
  const [minCents, unit] =
    salaryBasis === "net"
      ? [offers.salaryNetMinCents, offers.salaryNetUnit]
      : [offers.salaryGrossMinCents, offers.salaryGrossUnit]
  return and(eq(unit, "month"), gte(minCents, salaryMinMonthly * 100))
}

// H6 : aucune langue exigée, ou des langues exigées toutes parlées (`languages <@ spoken`).
const languages: Condition = ({ spokenLanguages }) =>
  selected(spokenLanguages)
    ? or(
        eq(offers.languagesRequired, "no"),
        and(
          eq(offers.languagesRequired, "yes"),
          arrayContained(offers.languages, spokenLanguages),
        ),
      )
    : undefined

const conditions: Condition[] = [
  occupation,
  location,
  dates,
  salary,
  ({ housing }) => (housing ? eq(offers.housing, "yes") : undefined),
  ({ meals }) => (meals ? eq(offers.meals, "yes") : undefined),
  // H8 : « Débutants acceptés », « Permis non exigé ».
  ({ beginnersWelcome }) =>
    beginnersWelcome ? eq(offers.experienceRequired, "no") : undefined,
  languages,
  // H7 : temps plein ou partiel, à l'identique.
  ({ workTime }) => (workTime ? eq(offers.workTime, workTime) : undefined),
  ({ noLicenseRequired }) =>
    noLicenseRequired ? eq(offers.drivingLicenseRequired, "no") : undefined,
  ({ couplesWelcome }) =>
    couplesWelcome ? eq(offers.couplesWelcome, "yes") : undefined,
  ({ petsAllowed }) =>
    petsAllowed ? eq(offers.petsAllowed, "yes") : undefined,
]

// Offres actives au jour `today` (AAAA-MM-JJ, Europe/Paris) satisfaisant tous les critères.
export function searchConditions(criteria: SearchCriteria, today: string) {
  return and(
    activeOfferConditions(today),
    ...conditions.map((condition) => condition(criteria)),
  )
}
