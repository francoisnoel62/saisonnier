import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

import type { AdmissionDecision } from "@/domain/scan/admission"
import type { Observation } from "@/domain/scan/observation"
import type { ScanProposal } from "@/domain/scan/proposal"
import {
  exclusionReasons,
  publicationKinds,
  rejectionReasons,
  scanCandidateStatuses,
  scanModes,
  scanReviewKinds,
  scanReviewStatuses,
  scanRunSourceStatuses,
  scanRunStatuses,
  scanRunTriggers,
  type ScanIssue,
} from "@/domain/scan/vocabulary"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"
import { offers } from "./offers"
import { occupations } from "./reference"

export const scanModeEnum = pgEnum("scan_mode", scanModes)
export const scanRunStatusEnum = pgEnum("scan_run_status", scanRunStatuses)
export const scanTriggerEnum = pgEnum("scan_trigger", scanRunTriggers)
export const scanRunSourceStatusEnum = pgEnum(
  "scan_run_source_status",
  scanRunSourceStatuses,
)
export const scanCandidateStatusEnum = pgEnum(
  "scan_candidate_status",
  scanCandidateStatuses,
)
export const scanExclusionReasonEnum = pgEnum(
  "scan_exclusion_reason",
  exclusionReasons,
)
export const scanRejectionReasonEnum = pgEnum(
  "scan_rejection_reason",
  rejectionReasons,
)
export const scanPublicationKindEnum = pgEnum(
  "scan_publication_kind",
  publicationKinds,
)
export const scanReviewKindEnum = pgEnum("scan_review_kind", scanReviewKinds)
export const scanReviewStatusEnum = pgEnum(
  "scan_review_status",
  scanReviewStatuses,
)
const instant = () => timestamp({ withTimezone: true })
const actor = () => text().references(() => user.id, { onDelete: "set null" })

// SH1 : l'absence de ligne désactive une source ; le registre reste en code.
export const scanSources = pgTable("scan_sources", {
  key: text().primaryKey(),
  enabled: boolean().notNull().default(false),
  autoPublish: boolean().notNull().default(false),
  updatedByUserId: actor(),
  ...timestamps,
})

export const scanRuns = pgTable(
  "scan_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    mode: scanModeEnum().notNull(),
    runKey: text().notNull().unique(),
    status: scanRunStatusEnum().notNull().default("queued"),
    trigger: scanTriggerEnum().notNull(),
    requestedByUserId: actor(),
    claimToken: uuid().notNull().defaultRandom(),
    workflowRunId: text(),
    startedAt: instant().notNull(),
    deadlineAt: instant(),
    windowStart: instant(),
    targetCount: integer(),
    deliveredCount: integer().notNull().default(0),
    firstDeliveredAt: instant(),
    targetReachedAt: instant(),
    stopRequestedAt: instant(),
    lastProgressAt: instant(),
    finishedAt: instant(),
    reportSentAt: instant(),
    ...timestamps,
  },
  (t) => [
    // SH2 : clé unique initiale ou quotidienne, et un seul passage actif, même en concurrence.
    check(
      "scan_runs_mode_window",
      sql`
    (${t.mode} = 'bootstrap' and ${t.runKey} = 'bootstrap'
      and ${t.deadlineAt} is not null and ${t.targetCount} is not null and ${t.windowStart} is null)
    or (${t.mode} = 'daily' and ${t.runKey} ~ '^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and ${t.windowStart} is not null and ${t.deadlineAt} is null and ${t.targetCount} is null)`,
    ),
    check(
      "scan_runs_finished_terminal",
      sql`(${t.finishedAt} is not null) = (${t.status} in ('stopped', 'completed', 'partial', 'failed'))`,
    ),
    check(
      "scan_runs_target",
      sql`(${t.targetReachedAt} is null or ${t.targetCount} is not null) and (${t.targetCount} is null or ${t.targetCount} > 0) and ${t.deliveredCount} >= 0`,
    ),
    uniqueIndex("scan_runs_single_active")
      .on(sql`(1)`)
      .where(sql`${t.status} in ('queued', 'running', 'stopping')`),
  ],
)

export const scanRunSources = pgTable(
  "scan_run_sources",
  {
    runId: uuid()
      .notNull()
      .references(() => scanRuns.id),
    sourceKey: text().notNull(),
    status: scanRunSourceStatusEnum().notNull().default("pending"),
    cursor: jsonb().$type<Record<string, unknown>>(),
    listedCount: integer().notNull().default(0),
    fetchedCount: integer().notNull().default(0),
    deliveredCount: integer().notNull().default(0),
    excludedCount: integer().notNull().default(0),
    failedCount: integer().notNull().default(0),
    requestCount: integer().notNull().default(0),
    bytesDownloaded: bigint({ mode: "number" }).notNull().default(0),
    lastRequestAt: instant(),
    lastError: text(),
    startedAt: instant(),
    finishedAt: instant(),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.sourceKey] }),
    check(
      "scan_run_sources_counts",
      sql`${t.listedCount} >= 0 and ${t.fetchedCount} >= 0 and ${t.deliveredCount} >= 0 and ${t.excludedCount} >= 0 and ${t.failedCount} >= 0 and ${t.requestCount} >= 0 and ${t.bytesDownloaded} >= 0`,
    ),
  ],
)

export const scanCandidates = pgTable(
  "scan_candidates",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceKey: text().notNull(),
    identityKey: text().notNull(),
    generation: integer().notNull().default(1),
    externalId: text(),
    discoveryUrl: text().notNull(),
    officialUrl: text(),
    status: scanCandidateStatusEnum().notNull().default("discovered"),
    exclusionReason: scanExclusionReasonEnum(),
    exclusionDetail: text(),
    rejectionReason: scanRejectionReasonEnum(),
    reviewNote: text(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    version: integer().notNull().default(1),
    firstSeenAt: instant().notNull().defaultNow(),
    lastSeenAt: instant().notNull().defaultNow(),
    lastFetchedAt: instant(),
    sourcePublishedDate: date(),
    sourcePublishedAt: instant(),
    firstRunId: uuid()
      .notNull()
      .references(() => scanRuns.id),
    deliveredRunId: uuid().references(() => scanRuns.id),
    readyForReviewAt: instant(),
    title: text(),
    pageText: text(),
    observations: jsonb().$type<Observation[]>().notNull().default([]),
    proposal: jsonb().$type<ScanProposal>(),
    issues: jsonb().$type<ScanIssue[]>().notNull().default([]),
    signals: jsonb()
      .$type<Extract<AdmissionDecision, { admitted: true }>["signals"]>()
      .notNull()
      .default([]),
    listingHash: text().notNull(),
    contentHash: text(),
    extractorVersion: text(),
    // RESTRICT : une annonce collectée ne disparaît pas sans traitement de son dossier.
    offerId: uuid()
      .unique()
      .references(() => offers.id, { onDelete: "restrict" }),
    publicationKind: scanPublicationKindEnum(),
    occupationReviewId: uuid().references((): AnyPgColumn => scanReviews.id),
    decidedAt: instant(),
    decidedByUserId: actor(),
    ...timestamps,
  },
  (t) => [
    unique("scan_candidates_identity_generation").on(
      t.sourceKey,
      t.identityKey,
      t.generation,
    ),
    // Motifs et états vont ensemble ; les décisions restent attachées au dossier livré.
    check(
      "scan_candidates_exclusion",
      sql`(${t.status} = 'excluded') = (${t.exclusionReason} is not null)`,
    ),
    check(
      "scan_candidates_rejection",
      sql`(${t.status} = 'rejected') = (${t.rejectionReason} is not null)`,
    ),
    check(
      "scan_candidates_delivery",
      sql`(${t.status} <> 'to_review' or ${t.readyForReviewAt} is not null) and (${t.readyForReviewAt} is null or (${t.title} is not null and ${t.deliveredRunId} is not null))`,
    ),
    check(
      "scan_candidates_publication",
      sql`(${t.status} = 'published') = (${t.offerId} is not null) and (${t.offerId} is null) = (${t.publicationKind} is null)`,
    ),
    check(
      "scan_candidates_source_date",
      sql`${t.sourcePublishedAt} is null or ${t.sourcePublishedDate} is not null`,
    ),
    // SH13 : bornes vérifiées aussi lorsque l'écriture ne passe pas par les services.
    check(
      "scan_candidates_content_bounds",
      sql`char_length(${t.pageText}) <= 20000 and jsonb_typeof(${t.observations}) = 'array' and jsonb_array_length(${t.observations}) <= 200`,
    ),
    check(
      "scan_candidates_versions",
      sql`${t.generation} >= 1 and ${t.version} >= 1 and ${t.attempts} >= 0`,
    ),
    check(
      "scan_candidates_text_not_blank",
      notBlank(t.title, t.identityKey, t.discoveryUrl),
    ),
    index().on(t.status, t.readyForReviewAt, t.id),
    index().on(t.deliveredRunId),
    index().on(t.sourceKey, t.status),
  ],
)

export const scanReviews = pgTable(
  "scan_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: scanReviewKindEnum().notNull(),
    groupKey: text().notNull(),
    status: scanReviewStatusEnum().notNull().default("open"),
    candidateId: uuid().references(() => scanCandidates.id),
    otherCandidateId: uuid().references(() => scanCandidates.id),
    offerId: uuid().references(() => offers.id),
    sourceKey: text(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    decision: jsonb().$type<Record<string, unknown>>(),
    decidedAt: instant(),
    decidedByUserId: actor(),
    occurrences: integer().notNull().default(1),
    lastSeenAt: instant().notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    unique("scan_reviews_kind_group").on(t.kind, t.groupKey),
    check(
      "scan_reviews_decision",
      sql`(${t.status} = 'open') = (${t.decidedAt} is null)`,
    ),
    check(
      "scan_reviews_references",
      sql`(${t.kind} <> 'duplicate' or (${t.candidateId} is not null and (${t.otherCandidateId} is not null or ${t.offerId} is not null))) and (${t.kind} <> 'divergence' or ${t.candidateId} is not null) and (${t.kind} <> 'incident' or ${t.sourceKey} is not null)`,
    ),
  ],
)

export type ScanRun = typeof scanRuns.$inferSelect
export const occupationAliases = pgTable(
  "occupation_aliases",
  {
    normalizedLabel: text().primaryKey(),
    occupationId: uuid()
      .notNull()
      .references(() => occupations.id),
    createdByUserId: actor(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    check("occupation_aliases_label_not_blank", notBlank(t.normalizedLabel)),
  ],
)
export type ScanRunSource = typeof scanRunSources.$inferSelect
export type ScanCandidate = typeof scanCandidates.$inferSelect
