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

import { MESSAGE_MAX_LENGTH } from "@/domain/contact"

import { offers } from "./offers"

// Demandes adressées au service : messages au fondateur ici, prestations au plan 17.

export const contactTopic = pgEnum("contact_topic", [
  "collected_offer",
  "employer",
  "candidate",
  "other",
])

export const contactStatus = pgEnum("contact_status", ["new", "handled"])

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    topic: contactTopic().notNull(),
    // Annonce concernée ; le message reste si l'annonce est supprimée.
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text().notNull(),
    companyName: text(),
    phone: text(),
    message: text().notNull(),
    // Compte connecté au moment de l'envoi, s'il y en avait un.
    userId: text(),
    status: contactStatus().notNull().default("new"),
    adminNote: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      "contact_messages_message_length",
      sql`char_length(${t.message}) <= ${sql.raw(String(MESSAGE_MAX_LENGTH))}`,
    ),
    // Limitation de débit par email, puis boîte de l'admin.
    index().on(t.email, t.createdAt),
    index().on(t.status, t.createdAt),
  ],
)

export type ContactMessage = typeof contactMessages.$inferSelect
