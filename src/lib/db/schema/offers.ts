import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

import {
  applicationChannels,
  durationUnits,
  offerOrigins,
  offerStatuses,
  seasons,
  workTimes,
} from "@/domain/offer"
import { salaryUnits } from "@/domain/salary"
import {
  confirmableFields,
  type ConfirmableField,
} from "@/domain/field-certainty"
import { triStates } from "@/domain/tri-state"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"
import { companies } from "./companies"
import { departments, occupations } from "./reference"

// Offres d'emploi saisonnier (§2, §3). Les valeurs des enums viennent de src/domain/.

export const triStateEnum = pgEnum("tri_state", triStates)
export const offerOriginEnum = pgEnum("offer_origin", offerOrigins)
export const offerStatusEnum = pgEnum("offer_status", offerStatuses)
export const seasonEnum = pgEnum("season", seasons)
export const durationUnitEnum = pgEnum("duration_unit", durationUnits)
export const salaryUnitEnum = pgEnum("salary_unit", salaryUnits)
export const workTimeEnum = pgEnum("work_time", workTimes)
export const applicationChannelEnum = pgEnum(
  "application_channel",
  applicationChannels,
)

// « Non précisé » par défaut : un champ laissé vide n'est jamais une réponse (§3).
const triState = () => triStateEnum().notNull().default("unknown")

// Pour une base (net ou brut) : montant et unité vont ensemble, le maximum est facultatif et au
// moins égal au minimum, les montants sont positifs.
function salaryCheck(
  name: string,
  minCents: AnyPgColumn,
  maxCents: AnyPgColumn,
  unit: AnyPgColumn,
) {
  return check(
    name,
    sql`(${minCents} is null) = (${unit} is null) and (${maxCents} is null or (${minCents} is not null and ${maxCents} >= ${minCents})) and (${minCents} is null or ${minCents} > 0)`,
  )
}

export const offers = pgTable(
  "offers",
  {
    // Identité
    id: uuid().primaryKey().defaultRandom(),
    origin: offerOriginEnum().notNull(),
    status: offerStatusEnum().notNull().default("pending_review"),
    // Entreprise identifiable (§3), même quand son identité est masquée aux candidats.
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    // Déposant ; null pour une annonce collectée, ou si son compte a été supprimé.
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    // H13 : l'intitulé est obligatoire, le métier du référentiel facultatif.
    title: text().notNull(),
    occupationId: uuid().references(() => occupations.id),

    // Contenu
    description: text(),
    missions: text(),

    // Contrat et période : des dates précises, ou une durée seule.
    season: seasonEnum(),
    startDate: date(),
    endDate: date(),
    durationValue: integer(),
    durationUnit: durationUnitEnum(),
    applicationDeadline: date(),

    // Lieu : le département sert à la recherche par département et par région.
    communeName: text().notNull(),
    communeInseeCode: text(),
    postalCode: text(),
    departmentCode: text()
      .notNull()
      .references(() => departments.code),
    // Station, lieu-dit.
    locationDetails: text(),

    // Rémunération : montants en centimes, chaque base dans l'unité de la source.
    salaryNetMinCents: integer(),
    salaryNetMaxCents: integer(),
    salaryNetUnit: salaryUnitEnum(),
    salaryGrossMinCents: integer(),
    salaryGrossMaxCents: integer(),
    salaryGrossUnit: salaryUnitEnum(),
    salaryNotes: text(),

    // Conditions
    housing: triState(),
    housingDetails: text(),
    meals: triState(),
    mealsDetails: text(),

    // Profil
    experienceRequired: triState(),
    experienceDetails: text(),
    languagesRequired: triState(),
    // Langues exigées, en codes ISO 639-1 ("en", "de") : une liste non vide si et seulement si
    // languagesRequired vaut "yes".
    languages: text().array().notNull().default([]),
    drivingLicenseRequired: triState(),
    drivingLicenseDetails: text(),

    // Organisation (H7)
    workTime: workTimeEnum().notNull().default("unknown"),
    weeklyHours: numeric({ precision: 3, scale: 1, mode: "number" }),
    scheduleDetails: text(),

    // Vie pratique
    couplesWelcome: triState(),
    petsAllowed: triState(),
    otherConstraints: text(),
    additionalInfo: text(),
    fieldsToConfirm: text()
      .array()
      .$type<ConfirmableField[]>()
      .notNull()
      .default([]),

    // Candidature (§5, §7)
    applicationChannel: applicationChannelEnum().notNull().default("employer"),
    applyEmail: text(),
    applyPhone: text(),
    applyUrl: text(),
    // Personne du service à qui le recrutement est confié (canal "recruiter").
    recruiterName: text(),
    hideCompanyIdentity: boolean().notNull().default(false),

    // Collecte : l'annonce est suivie à sa source (§6).
    sourceUrl: text(),
    sourceName: text(),
    sourceCheckedAt: timestamp({ withTimezone: true }),
    sourcePublishedDate: date(),
    sourcePublishedAt: timestamp({ withTimezone: true }),
    firstDiscoveredAt: timestamp({ withTimezone: true }),
    humanVerifiedAt: timestamp({ withTimezone: true }),
    humanVerifiedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),

    // Cycle de vie
    publishedAt: timestamp({ withTimezone: true }),
    validityConfirmedAt: timestamp({ withTimezone: true }),
    validityReminderSentAt: timestamp({ withTimezone: true }),
    unpublishedAt: timestamp({ withTimezone: true }),
    expiredAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "offers_additional_info",
      sql`${notBlank(t.additionalInfo)} and length(${t.additionalInfo}) <= 1000`,
    ),
    check(
      "offers_fields_to_confirm",
      sql`${t.fieldsToConfirm} <@ ARRAY[${sql.raw(confirmableFields.map((f) => `'${f}'`).join(", "))}]::text[] and array_position(${t.fieldsToConfirm}, null) is null`,
    ),
    check(
      "offers_confirmable_neutral",
      sql`
      (not ('salary' = any(${t.fieldsToConfirm})) or num_nonnulls(${t.salaryNetMinCents}, ${t.salaryNetMaxCents}, ${t.salaryNetUnit}, ${t.salaryGrossMinCents}, ${t.salaryGrossMaxCents}, ${t.salaryGrossUnit}) = 0)
      and (not ('housing' = any(${t.fieldsToConfirm})) or ${t.housing} = 'unknown')
      and (not ('meals' = any(${t.fieldsToConfirm})) or ${t.meals} = 'unknown')
      and (not ('experience' = any(${t.fieldsToConfirm})) or ${t.experienceRequired} = 'unknown')
      and (not ('driving_license' = any(${t.fieldsToConfirm})) or ${t.drivingLicenseRequired} = 'unknown')
      and (not ('couples' = any(${t.fieldsToConfirm})) or ${t.couplesWelcome} = 'unknown')
      and (not ('pets' = any(${t.fieldsToConfirm})) or ${t.petsAllowed} = 'unknown')
      and (not ('languages' = any(${t.fieldsToConfirm})) or ${t.languagesRequired} = 'unknown')
      and (not ('work_time' = any(${t.fieldsToConfirm})) or ${t.workTime} = 'unknown')`,
    ),
    check(
      "offers_human_verification_collected",
      sql`${t.humanVerifiedAt} is null or ${t.origin} = 'collected'`,
    ),
    check(
      "offers_source_publication_date",
      sql`${t.sourcePublishedAt} is null or ${t.sourcePublishedDate} is not null`,
    ),
    // Invariants, vrais pour toute ligne : les formulaires les vérifient avant d'enregistrer.
    check(
      "offers_text_not_blank",
      notBlank(
        t.title,
        t.communeName,
        t.applyEmail,
        t.applyPhone,
        t.applyUrl,
        t.recruiterName,
        t.sourceUrl,
      ),
    ),
    check(
      "offers_period_or_duration",
      sql`(${t.startDate} is not null and ${t.endDate} is not null) or (${t.durationValue} is not null and ${t.durationUnit} is not null)`,
    ),
    check("offers_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
    check(
      "offers_duration_complete",
      sql`(${t.durationValue} is null) = (${t.durationUnit} is null) and (${t.durationValue} is null or ${t.durationValue} > 0)`,
    ),
    check(
      "offers_application_means",
      sql`num_nonnulls(${t.applyEmail}, ${t.applyPhone}, ${t.applyUrl}) > 0`,
    ),
    salaryCheck(
      "offers_net_salary",
      t.salaryNetMinCents,
      t.salaryNetMaxCents,
      t.salaryNetUnit,
    ),
    salaryCheck(
      "offers_gross_salary",
      t.salaryGrossMinCents,
      t.salaryGrossMaxCents,
      t.salaryGrossUnit,
    ),
    // L'anonymat n'existe qu'avec l'intermédiation du service (§7).
    check(
      "offers_anonymity_requires_recruiter",
      sql`not ${t.hideCompanyIdentity} or ${t.applicationChannel} = 'recruiter'`,
    ),
    check(
      "offers_recruiter_named",
      sql`${t.applicationChannel} <> 'recruiter' or ${t.recruiterName} is not null`,
    ),
    check(
      "offers_collected_has_source",
      sql`${t.origin} <> 'collected' or (${t.sourceUrl} is not null and ${t.sourceCheckedAt} is not null)`,
    ),
    // Sans cela, « toutes les langues exigées sont parlées » serait vrai d'une liste vide (H6).
    check(
      "offers_languages_listed",
      sql`(${t.languagesRequired} = 'yes') = (cardinality(${t.languages}) > 0)`,
    ),
    check(
      "offers_language_codes",
      sql`array_to_string(${t.languages}, ',', '*') ~ '^([a-z]{2}(,[a-z]{2})*)?$'`,
    ),
    check("offers_weekly_hours_positive", sql`${t.weeklyHours} > 0`),
    // Le code INSEE d'une commune commence par celui de son département ("74056", "2A247").
    check(
      "offers_commune_in_department",
      sql`${t.communeInseeCode} is null or starts_with(${t.communeInseeCode}, ${t.departmentCode})`,
    ),
    // Une annonce publiée a une date de publication : la recherche trie sur elle.
    check(
      "offers_published_dated",
      sql`${t.status} <> 'published' or ${t.publishedAt} is not null`,
    ),

    index().on(t.status),
    index().on(t.companyId),
    index().on(t.departmentCode),
    index().on(t.occupationId),
    index().on(t.startDate, t.endDate),
    index().on(t.publishedAt),
    index().using("gin", t.languages),
    // Une page peut porter plusieurs recrutements ou être réutilisée une autre saison.
    index("offers_collected_source_url")
      .on(t.sourceUrl)
      .where(sql`${t.origin} = 'collected'`),
  ],
)

export const offersRelations = relations(offers, ({ one }) => ({
  createdBy: one(user, {
    fields: [offers.createdByUserId],
    references: [user.id],
  }),
  company: one(companies, {
    fields: [offers.companyId],
    references: [companies.id],
  }),
  occupation: one(occupations, {
    fields: [offers.occupationId],
    references: [occupations.id],
  }),
  department: one(departments, {
    fields: [offers.departmentCode],
    references: [departments.code],
  }),
}))

export type Offer = typeof offers.$inferSelect
export type NewOffer = typeof offers.$inferInsert
