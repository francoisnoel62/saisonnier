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
import {
  purchaseFormats,
  SERVICE_MESSAGE_MAX_LENGTH,
  serviceKinds,
  serviceRequestStatuses,
  serviceScopes,
} from "@/domain/service-request"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"
import { companies } from "./companies"
import { offers } from "./offers"

// Demandes adressées au service : messages au fondateur, et demandes de prestations (plan 17).

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

// Demandes de prestations des employeurs (§7, H15), traitées à la main par le fondateur.

export const serviceKindEnum = pgEnum("service_kind", serviceKinds)
export const serviceScopeEnum = pgEnum("service_scope", serviceScopes)
export const purchaseFormatEnum = pgEnum("purchase_format", purchaseFormats)
export const serviceRequestStatusEnum = pgEnum(
  "service_request_status",
  serviceRequestStatuses,
)

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Demandeur : son entreprise, et son compte tant qu'il existe.
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    requestedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    services: serviceKindEnum().array().notNull(),
    scope: serviceScopeEnum().notNull(),
    // Annonce concernée, pour la portée « offer » ; la demande reste si l'annonce disparaît.
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    scopeDetails: text(),
    purchaseFormat: purchaseFormatEnum().notNull(),
    message: text(),
    status: serviceRequestStatusEnum().notNull().default("new"),
    // Note interne du fondateur, jamais montrée à l'employeur.
    adminNote: text(),
    ...timestamps,
  },
  (t) => [
    check(
      "service_requests_text_not_blank",
      notBlank(t.scopeDetails, t.message, t.adminNote),
    ),
    check(
      "service_requests_services_listed",
      sql`cardinality(${t.services}) > 0`,
    ),
    // Une annonce ne se rattache qu'à une demande qui porte sur elle.
    check(
      "service_requests_offer_scope",
      sql`${t.offerId} is null or ${t.scope} = 'offer'`,
    ),
    check(
      "service_requests_message_length",
      sql`char_length(${t.message}) <= ${sql.raw(String(SERVICE_MESSAGE_MAX_LENGTH))}`,
    ),
    index().on(t.companyId, t.createdAt),
    index().on(t.status, t.createdAt),
  ],
)

export type ServiceRequest = typeof serviceRequests.$inferSelect
