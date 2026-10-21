import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// Tables de Better Auth, générées par `npx auth@latest generate --output src/lib/db/schema/auth.ts`,
// puis alignées sur le projet : colonnes nommées par `casing`, horodatages avec fuseau, rôle contrôlé.
// Better Auth vérifie au démarrage les noms des tables et des propriétés : ne pas les renommer.
// Les identifiants sont de type text : les clés étrangères vers user.id le sont aussi.

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    // H1 : candidat ou employeur à l'inscription, admin par le script admin:grant.
    role: text().notNull().default("candidate"),
    ...timestamps,
  },
  (t) => [
    // Mêmes valeurs que src/domain/roles.ts
    check(
      "user_role_valid",
      sql`${t.role} in ('candidate', 'employer', 'admin')`,
    ),
  ],
)

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    // Empreinte scrypt du mot de passe (compte "credential").
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

// Jetons de vérification d'email et de réinitialisation du mot de passe.
export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))
