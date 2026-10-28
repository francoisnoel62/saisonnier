CREATE TYPE "public"."scan_adapter" AS ENUM('teamtailor', 'factorial', 'france-travail', 'smartrecruiters', 'fixture');--> statement-breakpoint
CREATE TYPE "public"."scan_reuse_decision" AS ENUM('pending', 'authorized', 'accepted', 'refused');--> statement-breakpoint
CREATE TYPE "public"."scan_source_event_kind" AS ENUM('imported', 'created', 'revised', 'status_changed', 'switched', 'reuse_decided', 'probed', 'sampled', 'detected', 'suspended', 'resumed', 'company_linked', 'domain_excluded', 'alias_learned');--> statement-breakpoint
CREATE TYPE "public"."scan_source_kind" AS ENUM('employer', 'discovery');--> statement-breakpoint
CREATE TYPE "public"."scan_source_role" AS ENUM('primary', 'reserve');--> statement-breakpoint
CREATE TYPE "public"."scan_source_status" AS ENUM('draft', 'ready', 'rejected', 'archived');--> statement-breakpoint
ALTER TYPE "public"."scan_rejection_reason" ADD VALUE 'source_withdrawn';--> statement-breakpoint
CREATE TABLE "scan_source_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"kind" "scan_source_event_kind" NOT NULL,
	"revision" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_source_events_details" CHECK (jsonb_typeof("scan_source_events"."details") = 'object' and octet_length("scan_source_events"."details"::text) <= 32768)
);
--> statement-breakpoint
CREATE TABLE "scan_source_hosts" (
	"host" text PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	CONSTRAINT "scan_source_hosts_host" CHECK ("scan_source_hosts"."host" ~ '^[a-z0-9.-]+$' and char_length("scan_source_hosts"."host") <= 253)
);
--> statement-breakpoint
CREATE TABLE "scan_source_revisions" (
	"source_key" text NOT NULL,
	"revision" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"complete" boolean NOT NULL,
	"config_hash" text NOT NULL,
	"changed_fields" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_source_revisions_source_key_revision_pk" PRIMARY KEY("source_key","revision"),
	CONSTRAINT "scan_source_revisions_bounds" CHECK ("scan_source_revisions"."revision" >= 1 and jsonb_typeof("scan_source_revisions"."definition") = 'object' and octet_length("scan_source_revisions"."definition"::text) <= 65536 and "scan_source_revisions"."config_hash" ~ '^[0-9a-f]{64}$' and ("scan_source_revisions"."note" is null or "scan_source_revisions"."note" ~ '[^[:space:]]') and char_length("scan_source_revisions"."note") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD COLUMN "source_revision" integer;--> statement-breakpoint
ALTER TABLE "scan_run_sources" ADD COLUMN "source_revision" integer;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "kind" "scan_source_kind";--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "adapter" "scan_adapter";--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "status" "scan_source_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "revision" integer;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "role" "scan_source_role" DEFAULT 'reserve' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "priority" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "employer_name" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "employer_siren" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "employer_website" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "reuse_decision" "scan_reuse_decision" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "reuse_decision_note" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "reuse_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "reuse_decided_by_user_id" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "scheduled_access_basis" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "daily_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "scan_source_events" ADD CONSTRAINT "scan_source_events_source_key_scan_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."scan_sources"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_source_events" ADD CONSTRAINT "scan_source_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_source_hosts" ADD CONSTRAINT "scan_source_hosts_source_key_scan_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."scan_sources"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_source_revisions" ADD CONSTRAINT "scan_source_revisions_source_key_scan_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."scan_sources"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_source_revisions" ADD CONSTRAINT "scan_source_revisions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_source_events_source_key_created_at_index" ON "scan_source_events" USING btree ("source_key","created_at");--> statement-breakpoint
CREATE INDEX "scan_source_events_source_key_kind_created_at_index" ON "scan_source_events" USING btree ("source_key","kind","created_at");--> statement-breakpoint
CREATE INDEX "scan_source_hosts_source_key_index" ON "scan_source_hosts" USING btree ("source_key");--> statement-breakpoint
ALTER TABLE "scan_sources" ADD CONSTRAINT "scan_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD CONSTRAINT "scan_sources_reuse_decided_by_user_id_user_id_fk" FOREIGN KEY ("reuse_decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD CONSTRAINT "scan_sources_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_sources_status_priority_index" ON "scan_sources" USING btree ("status","priority");