import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// Référentiels : données insérées par migration SQL (drizzle/*_referentiels.sql).

export const regions = pgTable("regions", {
  // Code région du COG INSEE ("11", "84", "94"…)
  code: text().primaryKey(),
  name: text().notNull(),
})

export const departments = pgTable(
  "departments",
  {
    // Code département du COG INSEE : "01"…"95", "2A", "2B", "971"…"976"
    code: text().primaryKey(),
    name: text().notNull(),
    regionCode: text()
      .notNull()
      .references(() => regions.code),
  },
  (t) => [index().on(t.regionCode)],
)

export const occupations = pgTable("occupations", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  label: text().notNull(),
  family: text().notNull(),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
})

export const blockedDomains = pgTable(
  "blocked_domains",
  {
    // En minuscules et sans "www." : "indeed.com"
    domain: text().primaryKey(),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "blocked_domains_domain_normalized",
      sql`${t.domain} = lower(${t.domain}) and ${t.domain} not like 'www.%'`,
    ),
  ],
)
