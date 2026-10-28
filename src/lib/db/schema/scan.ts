import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
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
import type {
  ScanSourceDraftSnapshot,
  ScanSourceSnapshot,
} from "@/domain/scan/source"
import type { ScanSourceEventDetails } from "@/domain/scan/source-events"
import {
  exclusionReasons,
  publicationKinds,
  rejectionReasons,
  scanAdapterKinds,
  scanCandidateStatuses,
  scanModes,
  scanReuseDecisions,
  scanReviewKinds,
  scanReviewStatuses,
  scanRunSourceStatuses,
  scanRunStatuses,
  scanRunTriggers,
  scanSourceEventKinds,
  scanSourceKinds,
  scanSourceRoles,
  scanSourceStatuses,
  type ScanIssue,
} from "@/domain/scan/vocabulary"

import { user } from "./auth"
import { notBlank, timestamps } from "./columns"
import { companies } from "./companies"
import { offers } from "./offers"
import { occupations } from "./reference"

export type ScanListingData = {
  title?: string
  sourceDate?: string
  index?: number
  data: Record<string, unknown>
}

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
export const scanSourceKindEnum = pgEnum("scan_source_kind", scanSourceKinds)
export const scanSourceStatusEnum = pgEnum(
  "scan_source_status",
  scanSourceStatuses,
)
export const scanSourceRoleEnum = pgEnum("scan_source_role", scanSourceRoles)
export const scanAdapterEnum = pgEnum("scan_adapter", scanAdapterKinds)
export const scanReuseDecisionEnum = pgEnum(
  "scan_reuse_decision",
  scanReuseDecisions,
)
export const scanSourceEventKindEnum = pgEnum(
  "scan_source_event_kind",
  scanSourceEventKinds,
)
const instant = () => timestamp({ withTimezone: true })
const actor = () => text().references(() => user.id, { onDelete: "set null" })

// SH20 : registre administrable. La ligne porte l'identité (reflet de la version courante), le
// cycle de vie, les décisions et les interrupteurs ; la configuration lue est dans la version.
export const scanSources = pgTable(
  "scan_sources",
  {
    // Immuable, dans les URL de l'admin ; jamais réattribuée, même archivée.
    key: text().primaryKey(),
    label: text().notNull(),
    kind: scanSourceKindEnum().notNull(),
    // Nul : connecteur à déterminer (brouillon).
    adapter: scanAdapterEnum(),
    status: scanSourceStatusEnum().notNull().default("draft"),
    // Version courante de la configuration, sans clé étrangère (référence circulaire) :
    // writes.ts écrit la version et la ligne dans la même transaction.
    revision: integer().notNull(),
    role: scanSourceRoleEnum().notNull().default("reserve"),
    priority: integer().notNull().default(100),
    employerName: text(),
    employerSiren: text(),
    employerWebsite: text(),
    companyId: uuid().references(() => companies.id, { onDelete: "set null" }),
    reuseDecision: scanReuseDecisionEnum().notNull().default("pending"),
    reuseDecisionNote: text(),
    reuseDecidedAt: instant(),
    reuseDecidedByUserId: actor(),
    // Justification des passages quotidiens d'une découverte (SH24).
    scheduledAccessBasis: text(),
    enabled: boolean().notNull().default(false),
    dailyEnabled: boolean().notNull().default(false),
    autoPublish: boolean().notNull().default(false),
    suspendedAt: instant(),
    suspensionReason: text(),
    rejectionReason: text(),
    archivedAt: instant(),
    // Concurrence optimiste des formulaires.
    version: integer().notNull().default(1),
    createdByUserId: actor(),
    updatedByUserId: actor(),
    ...timestamps,
  },
  (t) => [
    check("scan_sources_key", sql`${t.key} ~ '^[a-z][a-z0-9-]{1,47}$'`),
    // SH17, D6 : un diffuseur n'est jamais l'employeur et ne publie jamais seul.
    check(
      "scan_sources_discovery",
      sql`${t.kind} <> 'discovery' or (${t.employerName} is null and ${t.employerSiren} is null and ${t.employerWebsite} is null and ${t.companyId} is null and not ${t.autoPublish})`,
    ),
    // La clé de Luhn est vérifiée par isValidSiren dans les schémas zod.
    check(
      "scan_sources_siren",
      sql`${t.employerSiren} is null or ${t.employerSiren} ~ '^[0-9]{9}$'`,
    ),
    // D5 : une source prête a son connecteur, une décision de reprise favorable et, pour un
    // portail employeur, l'employeur et son site.
    check(
      "scan_sources_ready",
      sql`${t.status} <> 'ready' or (${t.adapter} is not null and ${t.reuseDecision} in ('authorized', 'accepted') and (${t.kind} = 'discovery' or (${t.employerName} is not null and ${t.employerWebsite} is not null)))`,
    ),
    // D5, D11 : hors « Prête », aucun interrupteur.
    check(
      "scan_sources_switches",
      sql`${t.status} = 'ready' or (not ${t.enabled} and not ${t.dailyEnabled} and not ${t.autoPublish})`,
    ),
    // SH24 : les passages quotidiens d'une découverte exigent une justification écrite.
    check(
      "scan_sources_daily",
      sql`not ${t.dailyEnabled} or ${t.kind} = 'employer' or ${t.scheduledAccessBasis} is not null`,
    ),
    check(
      "scan_sources_rejected",
      sql`(${t.status} = 'rejected') = (${t.rejectionReason} is not null)`,
    ),
    check(
      "scan_sources_archived",
      sql`(${t.status} = 'archived') = (${t.archivedAt} is not null)`,
    ),
    // D9 : suspension datée et motivée.
    check(
      "scan_sources_suspended",
      sql`(${t.suspendedAt} is null) = (${t.suspensionReason} is null)`,
    ),
    // Décision de reprise datée et motivée.
    check(
      "scan_sources_reuse",
      sql`(${t.reuseDecision} = 'pending') = (${t.reuseDecidedAt} is null) and (${t.reuseDecision} = 'pending' or ${t.reuseDecisionNote} is not null)`,
    ),
    check(
      "scan_sources_counters",
      sql`${t.revision} >= 1 and ${t.version} >= 1 and ${t.priority} >= 0`,
    ),
    // Un texte absent s'écrit NULL ; bornes des libellés, motifs et notes.
    check(
      "scan_sources_texts",
      sql`${notBlank(t.label, t.employerName, t.employerSiren, t.employerWebsite, t.reuseDecisionNote, t.scheduledAccessBasis, t.suspensionReason, t.rejectionReason)} and char_length(${t.label}) <= 80 and char_length(${t.employerName}) <= 200 and char_length(${t.employerWebsite}) <= 2048 and char_length(${t.reuseDecisionNote}) <= 2000 and char_length(${t.suspensionReason}) <= 2000 and char_length(${t.rejectionReason}) <= 2000 and char_length(${t.scheduledAccessBasis}) <= 1000`,
    ),
    index().on(t.status, t.priority),
  ],
)

// SH22 : une version par modification ; seule une version complète peut être lue par un passage.
export const scanSourceRevisions = pgTable(
  "scan_source_revisions",
  {
    sourceKey: text()
      .notNull()
      .references(() => scanSources.key, { onDelete: "cascade" }),
    revision: integer().notNull(),
    // Instantané : ScanSourceDefinition sans key, revision, role ni priority (état de la ligne).
    definition: jsonb()
      .$type<ScanSourceSnapshot | ScanSourceDraftSnapshot>()
      .notNull(),
    // Conforme au schéma strict (scanSourceSnapshotSchema).
    complete: boolean().notNull(),
    // D4 : SHA-256 de sourceFingerprint(definition).
    configHash: text().notNull(),
    changedFields: text().array().notNull().default([]),
    // Motif de la modification.
    note: text(),
    createdByUserId: actor(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceKey, t.revision] }),
    check(
      "scan_source_revisions_bounds",
      sql`${t.revision} >= 1 and jsonb_typeof(${t.definition}) = 'object' and octet_length(${t.definition}::text) <= 65536 and ${t.configHash} ~ '^[0-9a-f]{64}$' and ${notBlank(t.note)} and char_length(${t.note}) <= 2000`,
    ),
  ],
)

// Journal : changements d'état, décisions et tests. Les tests sont bornés et purgés (SH30).
export const scanSourceEvents = pgTable(
  "scan_source_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceKey: text()
      .notNull()
      .references(() => scanSources.key, { onDelete: "cascade" }),
    kind: scanSourceEventKindEnum().notNull(),
    revision: integer(),
    details: jsonb().$type<ScanSourceEventDetails>().notNull().default({}),
    // Nul : système (migration, disjoncteur).
    actorUserId: actor(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    check(
      "scan_source_events_details",
      sql`jsonb_typeof(${t.details}) = 'object' and octet_length(${t.details}::text) <= 32768`,
    ),
    index().on(t.sourceKey, t.createdAt),
    index().on(t.sourceKey, t.kind, t.createdAt),
  ],
)

// D7 : un hôte officiel appartient à une seule source non archivée. L'origine locale de test
// n'y est jamais réservée.
export const scanSourceHosts = pgTable(
  "scan_source_hosts",
  {
    host: text().primaryKey(),
    sourceKey: text()
      .notNull()
      .references(() => scanSources.key, { onDelete: "cascade" }),
  },
  (t) => [
    check(
      "scan_source_hosts_host",
      sql`${t.host} ~ '^[a-z0-9.-]+$' and char_length(${t.host}) <= 253`,
    ),
    index().on(t.sourceKey),
  ],
)

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
    // SH22 : version de la source figée au démarrage du passage.
    sourceRevision: integer().notNull(),
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
    // Empreinte du robots.txt lu pendant le passage (lot E : changement signalé).
    robotsDigest: text(),
    startedAt: instant(),
    finishedAt: instant(),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.sourceKey] }),
    // RESTRICT : une source lue par un passage ne se supprime pas, elle s'archive (D2).
    foreignKey({
      name: "scan_run_sources_source_revision_fk",
      columns: [t.sourceKey, t.sourceRevision],
      foreignColumns: [
        scanSourceRevisions.sourceKey,
        scanSourceRevisions.revision,
      ],
    }).onDelete("restrict"),
    // Santé et rendement par source (lot E).
    index().on(t.sourceKey, t.runId),
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
    sourceKey: text()
      .notNull()
      .references(() => scanSources.key, { onDelete: "restrict" }),
    // Version figée du passage qui a découvert la piste ; nulle pour les pistes antérieures.
    sourceRevision: integer(),
    identityKey: text().notNull(),
    generation: integer().notNull().default(1),
    externalId: text(),
    discoveryUrl: text().notNull(),
    // Données de la liste relues par l'adaptateur à la lecture de la fiche (plan scan 09) :
    // intitulé, date source, lieux annoncés ; bornées à l'écriture (boundListing).
    listing: jsonb().$type<ScanListingData>(),
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
    sourceKey: text().references(() => scanSources.key, {
      onDelete: "restrict",
    }),
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
export type ScanSourceRow = typeof scanSources.$inferSelect
export type ScanSourceRevision = typeof scanSourceRevisions.$inferSelect
export type ScanSourceEvent = typeof scanSourceEvents.$inferSelect
export type ScanCandidate = typeof scanCandidates.$inferSelect
