import { sql } from "drizzle-orm"
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import {
  APPLICATION_MESSAGE_MAX_LENGTH,
  DOCUMENT_MAX_BYTES,
} from "@/domain/candidate-dossier"

import { user } from "./auth"
import { notBlank } from "./columns"

// Dossier du candidat (plan 10). Le nom vient de user.name et l'email du compte. Les documents
// sont dans un stockage privé : la table n'en garde que le chemin, jamais une URL publique.
export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    phone: text(),
    city: text(),
    cvPathname: text(),
    cvFilename: text(),
    cvSize: integer(),
    cvUploadedAt: timestamp({ withTimezone: true }),
    coverLetterPathname: text(),
    coverLetterFilename: text(),
    coverLetterUploadedAt: timestamp({ withTimezone: true }),
    // Préremplit les emails de candidature (plan 11).
    applicationMessage: text(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "candidate_profiles_text_not_blank",
      notBlank(
        t.phone,
        t.city,
        t.cvPathname,
        t.cvFilename,
        t.coverLetterPathname,
        t.coverLetterFilename,
        t.applicationMessage,
      ),
    ),
    // Un document est décrit entièrement, ou pas du tout.
    check(
      "candidate_profiles_cv_complete",
      sql`num_nulls(${t.cvPathname}, ${t.cvFilename}, ${t.cvSize}, ${t.cvUploadedAt}) in (0, 4)`,
    ),
    check(
      "candidate_profiles_cover_letter_complete",
      sql`num_nulls(${t.coverLetterPathname}, ${t.coverLetterFilename}, ${t.coverLetterUploadedAt}) in (0, 3)`,
    ),
    check(
      "candidate_profiles_cv_size",
      sql`${t.cvSize} between 1 and ${sql.raw(String(DOCUMENT_MAX_BYTES))}`,
    ),
    check(
      "candidate_profiles_message_length",
      sql`char_length(${t.applicationMessage}) <= ${sql.raw(String(APPLICATION_MESSAGE_MAX_LENGTH))}`,
    ),
  ],
)

export type CandidateProfile = typeof candidateProfiles.$inferSelect
