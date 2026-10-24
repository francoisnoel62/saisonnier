CREATE TYPE "public"."scan_candidate_status" AS ENUM('discovered', 'excluded', 'failed', 'to_review', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."scan_exclusion_reason" AS ENUM('no_content', 'out_of_scope', 'closed', 'outside_window', 'already_known', 'not_french', 'outside_france', 'test_data');--> statement-breakpoint
CREATE TYPE "public"."scan_mode" AS ENUM('bootstrap', 'daily');--> statement-breakpoint
CREATE TYPE "public"."scan_publication_kind" AS ENUM('human', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."scan_rejection_reason" AS ENUM('out_of_scope', 'closed', 'duplicate', 'no_content', 'missing_minimum', 'employer_unreachable', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_review_kind" AS ENUM('duplicate', 'divergence', 'incident', 'occupation');--> statement-breakpoint
CREATE TYPE "public"."scan_review_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."scan_run_source_status" AS ENUM('pending', 'listing', 'processing', 'done', 'failed', 'blocked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."scan_run_status" AS ENUM('queued', 'running', 'stopping', 'stopped', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_trigger" AS ENUM('admin', 'cron');--> statement-breakpoint
CREATE TABLE "scan_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"identity_key" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"external_id" text,
	"discovery_url" text NOT NULL,
	"official_url" text,
	"status" "scan_candidate_status" DEFAULT 'discovered' NOT NULL,
	"exclusion_reason" "scan_exclusion_reason",
	"exclusion_detail" text,
	"rejection_reason" "scan_rejection_reason",
	"review_note" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"source_published_date" date,
	"source_published_at" timestamp with time zone,
	"first_run_id" uuid NOT NULL,
	"delivered_run_id" uuid,
	"ready_for_review_at" timestamp with time zone,
	"title" text,
	"page_text" text,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal" jsonb,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"listing_hash" text NOT NULL,
	"content_hash" text,
	"extractor_version" text,
	"offer_id" uuid,
	"publication_kind" "scan_publication_kind",
	"occupation_review_id" uuid,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_candidates_offerId_unique" UNIQUE("offer_id"),
	CONSTRAINT "scan_candidates_identity_generation" UNIQUE("source_key","identity_key","generation"),
	CONSTRAINT "scan_candidates_exclusion" CHECK (("scan_candidates"."status" = 'excluded') = ("scan_candidates"."exclusion_reason" is not null)),
	CONSTRAINT "scan_candidates_rejection" CHECK (("scan_candidates"."status" = 'rejected') = ("scan_candidates"."rejection_reason" is not null)),
	CONSTRAINT "scan_candidates_delivery" CHECK (("scan_candidates"."status" <> 'to_review' or "scan_candidates"."ready_for_review_at" is not null) and ("scan_candidates"."ready_for_review_at" is null or ("scan_candidates"."title" is not null and "scan_candidates"."delivered_run_id" is not null))),
	CONSTRAINT "scan_candidates_publication" CHECK (("scan_candidates"."status" = 'published') = ("scan_candidates"."offer_id" is not null) and ("scan_candidates"."offer_id" is null) = ("scan_candidates"."publication_kind" is null)),
	CONSTRAINT "scan_candidates_source_date" CHECK ("scan_candidates"."source_published_at" is null or "scan_candidates"."source_published_date" is not null),
	CONSTRAINT "scan_candidates_content_bounds" CHECK (char_length("scan_candidates"."page_text") <= 20000 and jsonb_typeof("scan_candidates"."observations") = 'array' and jsonb_array_length("scan_candidates"."observations") <= 200),
	CONSTRAINT "scan_candidates_versions" CHECK ("scan_candidates"."generation" >= 1 and "scan_candidates"."version" >= 1 and "scan_candidates"."attempts" >= 0),
	CONSTRAINT "scan_candidates_text_not_blank" CHECK (("scan_candidates"."title" is null or "scan_candidates"."title" ~ '[^[:space:]]') and ("scan_candidates"."identity_key" is null or "scan_candidates"."identity_key" ~ '[^[:space:]]') and ("scan_candidates"."discovery_url" is null or "scan_candidates"."discovery_url" ~ '[^[:space:]]'))
);
--> statement-breakpoint
CREATE TABLE "scan_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "scan_review_kind" NOT NULL,
	"group_key" text NOT NULL,
	"status" "scan_review_status" DEFAULT 'open' NOT NULL,
	"candidate_id" uuid,
	"other_candidate_id" uuid,
	"offer_id" uuid,
	"source_key" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision" jsonb,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_reviews_kind_group" UNIQUE("kind","group_key"),
	CONSTRAINT "scan_reviews_decision" CHECK (("scan_reviews"."status" = 'open') = ("scan_reviews"."decided_at" is null)),
	CONSTRAINT "scan_reviews_references" CHECK (("scan_reviews"."kind" <> 'duplicate' or ("scan_reviews"."candidate_id" is not null and ("scan_reviews"."other_candidate_id" is not null or "scan_reviews"."offer_id" is not null))) and ("scan_reviews"."kind" <> 'divergence' or "scan_reviews"."candidate_id" is not null) and ("scan_reviews"."kind" <> 'incident' or "scan_reviews"."source_key" is not null))
);
--> statement-breakpoint
CREATE TABLE "scan_run_sources" (
	"run_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"status" "scan_run_source_status" DEFAULT 'pending' NOT NULL,
	"cursor" jsonb,
	"listed_count" integer DEFAULT 0 NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"excluded_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"bytes_downloaded" bigint DEFAULT 0 NOT NULL,
	"last_request_at" timestamp with time zone,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "scan_run_sources_run_id_source_key_pk" PRIMARY KEY("run_id","source_key"),
	CONSTRAINT "scan_run_sources_counts" CHECK ("scan_run_sources"."listed_count" >= 0 and "scan_run_sources"."fetched_count" >= 0 and "scan_run_sources"."delivered_count" >= 0 and "scan_run_sources"."excluded_count" >= 0 and "scan_run_sources"."failed_count" >= 0 and "scan_run_sources"."request_count" >= 0 and "scan_run_sources"."bytes_downloaded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "scan_mode" NOT NULL,
	"run_key" text NOT NULL,
	"status" "scan_run_status" DEFAULT 'queued' NOT NULL,
	"trigger" "scan_trigger" NOT NULL,
	"requested_by_user_id" text,
	"claim_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone,
	"window_start" timestamp with time zone,
	"target_count" integer,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"first_delivered_at" timestamp with time zone,
	"target_reached_at" timestamp with time zone,
	"stop_requested_at" timestamp with time zone,
	"last_progress_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"report_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_runs_runKey_unique" UNIQUE("run_key"),
	CONSTRAINT "scan_runs_mode_window" CHECK (
    ("scan_runs"."mode" = 'bootstrap' and "scan_runs"."run_key" = 'bootstrap'
      and "scan_runs"."deadline_at" is not null and "scan_runs"."target_count" is not null and "scan_runs"."window_start" is null)
    or ("scan_runs"."mode" = 'daily' and "scan_runs"."run_key" ~ '^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and "scan_runs"."window_start" is not null and "scan_runs"."deadline_at" is null and "scan_runs"."target_count" is null)),
	CONSTRAINT "scan_runs_finished_terminal" CHECK (("scan_runs"."finished_at" is not null) = ("scan_runs"."status" in ('stopped', 'completed', 'partial', 'failed'))),
	CONSTRAINT "scan_runs_target" CHECK (("scan_runs"."target_reached_at" is null or "scan_runs"."target_count" is not null) and ("scan_runs"."target_count" is null or "scan_runs"."target_count" > 0) and "scan_runs"."delivered_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scan_sources" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_publish" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_first_run_id_scan_runs_id_fk" FOREIGN KEY ("first_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_delivered_run_id_scan_runs_id_fk" FOREIGN KEY ("delivered_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_occupation_review_id_scan_reviews_id_fk" FOREIGN KEY ("occupation_review_id") REFERENCES "public"."scan_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reviews" ADD CONSTRAINT "scan_reviews_candidate_id_scan_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."scan_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reviews" ADD CONSTRAINT "scan_reviews_other_candidate_id_scan_candidates_id_fk" FOREIGN KEY ("other_candidate_id") REFERENCES "public"."scan_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reviews" ADD CONSTRAINT "scan_reviews_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_reviews" ADD CONSTRAINT "scan_reviews_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_run_sources" ADD CONSTRAINT "scan_run_sources_run_id_scan_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD CONSTRAINT "scan_sources_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_candidates_status_ready_for_review_at_id_index" ON "scan_candidates" USING btree ("status","ready_for_review_at","id");--> statement-breakpoint
CREATE INDEX "scan_candidates_delivered_run_id_index" ON "scan_candidates" USING btree ("delivered_run_id");--> statement-breakpoint
CREATE INDEX "scan_candidates_source_key_status_index" ON "scan_candidates" USING btree ("source_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_runs_single_active" ON "scan_runs" USING btree ((1)) WHERE "scan_runs"."status" in ('queued', 'running', 'stopping');