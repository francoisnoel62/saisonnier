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

import { membershipStatuses } from "@/domain/membership"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"

// Entreprises et rattachement de leurs déposants (plan 13).

export const membershipStatusEnum = pgEnum(
  "membership_status",
  membershipStatuses,
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
    website: text(),
    ...timestamps,
  },
  (t) => [
    check("companies_text_not_blank", notBlank(t.legalName, t.displayName)),
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
    relationship: text().notNull(),
    phone: text(),
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
      notBlank(t.jobTitle, t.relationship, t.phone),
    ),
    index().on(t.companyId),
  ],
)

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
export type CompanyMember = typeof companyMembers.$inferSelect
