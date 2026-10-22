import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { memberRelationships, membershipStatuses } from "@/domain/membership"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"

// Entreprises et rattachement de leurs déposants (plan 13).

export const membershipStatusEnum = pgEnum(
  "membership_status",
  membershipStatuses,
)
export const memberRelationshipEnum = pgEnum(
  "member_relationship",
  memberRelationships,
)

export const companies = pgTable(
  "companies",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Raison sociale ; l'enseigne, si elle existe, est le nom montré aux candidats.
    legalName: text().notNull(),
    displayName: text(),
    // Chiffres seuls, sans espaces : une entreprise déjà connue se retrouve par son SIREN.
    siren: text().unique(),
    siret: text(),
    // Activité principale ("55.10Z", « Hôtels et hébergement similaire ») : aide à vérifier
    // que l'entreprise relève du tourisme ou de l'hôtellerie de loisirs (§2).
    nafCode: text(),
    nafLabel: text(),
    // Commune du siège ou de l'établissement déclaré.
    communeName: text(),
    website: text(),
    ...timestamps,
  },
  (t) => [
    check(
      "companies_text_not_blank",
      notBlank(
        t.legalName,
        t.displayName,
        t.nafLabel,
        t.communeName,
        t.website,
      ),
    ),
    check("companies_siren_format", sql`${t.siren} ~ '^[0-9]{9}$'`),
    // Un SIRET (14 chiffres) commence par le SIREN de son entreprise.
    check(
      "companies_siret_format",
      sql`${t.siret} is null or (${t.siret} ~ '^[0-9]{14}$' and ${t.siren} is not null and starts_with(${t.siret}, ${t.siren}))`,
    ),
  ],
)

export const companyMembers = pgTable(
  "company_members",
  {
    // En V1, un employeur = une entreprise.
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    // Fonction et lien avec l'entreprise : ce que l'admin vérifie avant toute publication (H2).
    jobTitle: text().notNull(),
    relationship: memberRelationshipEnum().notNull(),
    // Précision du lien « autre ».
    relationshipDetails: text(),
    phone: text(),
    // Case « Je certifie être habilité·e à publier des offres pour cette entreprise ».
    certifiedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: membershipStatusEnum().notNull().default("pending"),
    // Décision de l'admin.
    reviewNote: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "company_members_text_not_blank",
      notBlank(t.jobTitle, t.relationshipDetails, t.phone, t.reviewNote),
    ),
    check(
      "company_members_relationship_details",
      sql`(${t.relationship} = 'other') = (${t.relationshipDetails} is not null)`,
    ),
    // Une décision est datée ; un refus est toujours motivé (le motif est envoyé à l'employeur).
    check(
      "company_members_reviewed",
      sql`(${t.status} = 'pending') = (${t.reviewedAt} is null)`,
    ),
    check(
      "company_members_rejection_motivated",
      sql`${t.status} <> 'rejected' or ${t.reviewNote} is not null`,
    ),
    index().on(t.companyId),
  ],
)

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
export type CompanyMember = typeof companyMembers.$inferSelect
