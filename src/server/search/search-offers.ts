import { asc, desc, eq, sql } from "drizzle-orm"

import { publicCompanyName } from "@/domain/application"
import type { DurationUnit, OfferOrigin, Season } from "@/domain/offer"
import { todayInParis } from "@/domain/offer-activity"
import {
  provenanceOf,
  newnessOf,
  type Provenance,
  type Newness,
} from "@/domain/offer-labels"
import type { ConfirmableField } from "@/domain/field-certainty"
import { displayedSalary, type SalaryStatement } from "@/domain/salary"
import type { SearchCriteria } from "@/domain/search-criteria"
import type { TriState } from "@/domain/tri-state"
import { db } from "@/lib/db"
import { companies, departments, offers, user } from "@/lib/db/schema"

import { searchConditions } from "./build-conditions"

// Ce qu'affiche la carte d'une offre dans les résultats (plan 09), rien de plus : ni contact, ni
// identité masquée.
export type OfferListItem = {
  id: string
  title: string
  // publicCompanyName : « Entreprise confidentielle » si l'identité est masquée.
  companyName: string
  communeName: string
  department: { code: string; name: string }
  season: Season | null
  // Des dates précises, ou une durée seule.
  startDate: string | null
  endDate: string | null
  durationValue: number | null
  durationUnit: DurationUnit | null
  // displayedSalary : null si aucun salaire n'est indiqué.
  salary: SalaryStatement | null
  housing: TriState
  meals: TriState
  origin: OfferOrigin
  provenance: Provenance
  externalApplication: boolean
  newness: Newness | null
  fieldsToConfirm: ConfirmableField[]
  placesCount: number
}

// Colonnes lues pour une carte, à joindre à companies et departments ; toOfferListItem les réduit
// à ce que la carte affiche. Réutilisées par « Mes offres » (plan 12).
export const offerListColumns = {
  id: offers.id,
  title: offers.title,
  hideCompanyIdentity: offers.hideCompanyIdentity,
  company: {
    legalName: companies.legalName,
    displayName: companies.displayName,
  },
  communeName: offers.communeName,
  department: { code: departments.code, name: departments.name },
  season: offers.season,
  startDate: offers.startDate,
  endDate: offers.endDate,
  durationValue: offers.durationValue,
  durationUnit: offers.durationUnit,
  salaryNetMinCents: offers.salaryNetMinCents,
  salaryNetMaxCents: offers.salaryNetMaxCents,
  salaryNetUnit: offers.salaryNetUnit,
  salaryGrossMinCents: offers.salaryGrossMinCents,
  salaryGrossMaxCents: offers.salaryGrossMaxCents,
  salaryGrossUnit: offers.salaryGrossUnit,
  housing: offers.housing,
  meals: offers.meals,
  origin: offers.origin,
  humanVerifiedAt: offers.humanVerifiedAt,
  createdBy: { role: user.role },
  externalApplication: sql<boolean>`${offers.applicationChannel} = 'employer' and ${offers.applyEmail} is null and ${offers.applyPhone} is null and ${offers.applyUrl} is not null`,
  sourcePublishedDate: offers.sourcePublishedDate,
  sourcePublishedAt: offers.sourcePublishedAt,
  firstDiscoveredAt: offers.firstDiscoveredAt,
  publishedAt: offers.publishedAt,
  fieldsToConfirm: offers.fieldsToConfirm,
  placesCount:
    sql<number>`1 + (select count(*)::int from offer_locations where offer_id = "offers"."id")`.mapWith(
      Number,
    ),
}

// Une ligne lue avec offerListColumns (et éventuellement d'autres colonnes).
function offerListQuery() {
  return db
    .select(offerListColumns)
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .innerJoin(departments, eq(departments.code, offers.departmentCode))
    .leftJoin(user, eq(user.id, offers.createdByUserId))
}
type OfferListRow = Awaited<ReturnType<typeof offerListQuery>>[number]

export function toOfferListItem(row: OfferListRow): OfferListItem {
  return {
    id: row.id,
    title: row.title,
    companyName: publicCompanyName(row),
    communeName: row.communeName,
    department: row.department,
    season: row.season,
    startDate: row.startDate,
    endDate: row.endDate,
    durationValue: row.durationValue,
    durationUnit: row.durationUnit,
    salary: displayedSalary(row),
    housing: row.housing,
    meals: row.meals,
    origin: row.origin,
    provenance: provenanceOf(row),
    externalApplication: row.externalApplication,
    newness: newnessOf(row),
    fieldsToConfirm: row.fieldsToConfirm,
    placesCount: row.placesCount,
  }
}

export const DEFAULT_PAGE_SIZE = 20

export type SearchOptions = {
  // À partir de 1.
  page?: number
  pageSize?: number
  // AAAA-MM-JJ, Europe/Paris ; par défaut, aujourd'hui.
  today?: string
}

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} doit être un entier positif : ${value}.`)
  }
}

// Les offres actives satisfaisant tous les critères, les plus récemment publiées d'abord, et
// leur nombre total. L'identifiant départage les dates égales : la pagination est stable.
export async function searchOffers(
  criteria: SearchCriteria,
  {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    today = todayInParis(new Date()),
  }: SearchOptions = {},
): Promise<{ items: OfferListItem[]; total: number }> {
  assertPositiveInteger("page", page)
  assertPositiveInteger("pageSize", pageSize)
  const where = searchConditions(criteria, today)

  const [rows, total] = await Promise.all([
    offerListQuery()
      .where(where)
      .orderBy(
        desc(
          sql`coalesce(${offers.sourcePublishedDate}, (${offers.publishedAt} at time zone 'Europe/Paris')::date)`,
        ),
        desc(sql`coalesce(${offers.sourcePublishedAt}, ${offers.publishedAt})`),
        asc(offers.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(offers, where),
  ])

  return { items: rows.map(toOfferListItem), total }
}
