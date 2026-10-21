CREATE TYPE "public"."membership_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."application_channel" AS ENUM('employer', 'recruiter');--> statement-breakpoint
CREATE TYPE "public"."duration_unit" AS ENUM('weeks', 'months');--> statement-breakpoint
CREATE TYPE "public"."offer_origin" AS ENUM('deposited', 'collected');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('pending_review', 'published', 'unpublished', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."salary_unit" AS ENUM('hour', 'day', 'week', 'month', 'season', 'lump_sum');--> statement-breakpoint
CREATE TYPE "public"."season" AS ENUM('summer', 'winter');--> statement-breakpoint
CREATE TYPE "public"."tri_state" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."work_time" AS ENUM('full_time', 'part_time', 'unknown');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text,
	"siren" text,
	"siret" text,
	"naf_code" text,
	"naf_label" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_siren_unique" UNIQUE("siren"),
	CONSTRAINT "companies_text_not_blank" CHECK (("companies"."legal_name" is null or "companies"."legal_name" ~ '[^[:space:]]') and ("companies"."display_name" is null or "companies"."display_name" ~ '[^[:space:]]')),
	CONSTRAINT "companies_siren_format" CHECK ("companies"."siren" ~ '^[0-9]{9}$'),
	CONSTRAINT "companies_siret_format" CHECK ("companies"."siret" is null or ("companies"."siret" ~ '^[0-9]{14}$' and "companies"."siren" is not null and starts_with("companies"."siret", "companies"."siren")))
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"user_id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_title" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_text_not_blank" CHECK (("company_members"."job_title" is null or "company_members"."job_title" ~ '[^[:space:]]') and ("company_members"."relationship" is null or "company_members"."relationship" ~ '[^[:space:]]') and ("company_members"."phone" is null or "company_members"."phone" ~ '[^[:space:]]'))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" "offer_origin" NOT NULL,
	"status" "offer_status" DEFAULT 'pending_review' NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_user_id" text,
	"title" text NOT NULL,
	"occupation_id" uuid,
	"description" text,
	"missions" text,
	"season" "season" NOT NULL,
	"start_date" date,
	"end_date" date,
	"duration_value" integer,
	"duration_unit" "duration_unit",
	"application_deadline" date,
	"commune_name" text NOT NULL,
	"commune_insee_code" text,
	"postal_code" text,
	"department_code" text NOT NULL,
	"location_details" text,
	"salary_net_min_cents" integer,
	"salary_net_max_cents" integer,
	"salary_net_unit" "salary_unit",
	"salary_gross_min_cents" integer,
	"salary_gross_max_cents" integer,
	"salary_gross_unit" "salary_unit",
	"salary_notes" text,
	"housing" "tri_state" DEFAULT 'unknown' NOT NULL,
	"housing_details" text,
	"meals" "tri_state" DEFAULT 'unknown' NOT NULL,
	"meals_details" text,
	"experience_required" "tri_state" DEFAULT 'unknown' NOT NULL,
	"experience_details" text,
	"languages_required" "tri_state" DEFAULT 'unknown' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"driving_license_required" "tri_state" DEFAULT 'unknown' NOT NULL,
	"driving_license_details" text,
	"work_time" "work_time" DEFAULT 'unknown' NOT NULL,
	"weekly_hours" numeric(3, 1),
	"schedule_details" text,
	"couples_welcome" "tri_state" DEFAULT 'unknown' NOT NULL,
	"pets_allowed" "tri_state" DEFAULT 'unknown' NOT NULL,
	"other_constraints" text,
	"application_channel" "application_channel" DEFAULT 'employer' NOT NULL,
	"apply_email" text,
	"apply_phone" text,
	"apply_url" text,
	"recruiter_name" text,
	"hide_company_identity" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"source_name" text,
	"source_checked_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"validity_confirmed_at" timestamp with time zone,
	"validity_reminder_sent_at" timestamp with time zone,
	"unpublished_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_text_not_blank" CHECK (("offers"."title" is null or "offers"."title" ~ '[^[:space:]]') and ("offers"."commune_name" is null or "offers"."commune_name" ~ '[^[:space:]]') and ("offers"."apply_email" is null or "offers"."apply_email" ~ '[^[:space:]]') and ("offers"."apply_phone" is null or "offers"."apply_phone" ~ '[^[:space:]]') and ("offers"."apply_url" is null or "offers"."apply_url" ~ '[^[:space:]]') and ("offers"."recruiter_name" is null or "offers"."recruiter_name" ~ '[^[:space:]]') and ("offers"."source_url" is null or "offers"."source_url" ~ '[^[:space:]]')),
	CONSTRAINT "offers_period_or_duration" CHECK (("offers"."start_date" is not null and "offers"."end_date" is not null) or ("offers"."duration_value" is not null and "offers"."duration_unit" is not null)),
	CONSTRAINT "offers_dates_ordered" CHECK ("offers"."end_date" >= "offers"."start_date"),
	CONSTRAINT "offers_duration_complete" CHECK (("offers"."duration_value" is null) = ("offers"."duration_unit" is null) and ("offers"."duration_value" is null or "offers"."duration_value" > 0)),
	CONSTRAINT "offers_application_means" CHECK (num_nonnulls("offers"."apply_email", "offers"."apply_phone", "offers"."apply_url") > 0),
	CONSTRAINT "offers_net_salary" CHECK (("offers"."salary_net_min_cents" is null) = ("offers"."salary_net_unit" is null) and ("offers"."salary_net_max_cents" is null or ("offers"."salary_net_min_cents" is not null and "offers"."salary_net_max_cents" >= "offers"."salary_net_min_cents")) and ("offers"."salary_net_min_cents" is null or "offers"."salary_net_min_cents" > 0)),
	CONSTRAINT "offers_gross_salary" CHECK (("offers"."salary_gross_min_cents" is null) = ("offers"."salary_gross_unit" is null) and ("offers"."salary_gross_max_cents" is null or ("offers"."salary_gross_min_cents" is not null and "offers"."salary_gross_max_cents" >= "offers"."salary_gross_min_cents")) and ("offers"."salary_gross_min_cents" is null or "offers"."salary_gross_min_cents" > 0)),
	CONSTRAINT "offers_anonymity_requires_recruiter" CHECK (not "offers"."hide_company_identity" or "offers"."application_channel" = 'recruiter'),
	CONSTRAINT "offers_recruiter_named" CHECK ("offers"."application_channel" <> 'recruiter' or "offers"."recruiter_name" is not null),
	CONSTRAINT "offers_collected_has_source" CHECK ("offers"."origin" <> 'collected' or ("offers"."source_url" is not null and "offers"."source_checked_at" is not null)),
	CONSTRAINT "offers_languages_listed" CHECK (("offers"."languages_required" = 'yes') = (cardinality("offers"."languages") > 0)),
	CONSTRAINT "offers_language_codes" CHECK (array_to_string("offers"."languages", ',', '*') ~ '^([a-z]{2}(,[a-z]{2})*)?$'),
	CONSTRAINT "offers_weekly_hours_positive" CHECK ("offers"."weekly_hours" > 0),
	CONSTRAINT "offers_commune_in_department" CHECK ("offers"."commune_insee_code" is null or starts_with("offers"."commune_insee_code", "offers"."department_code")),
	CONSTRAINT "offers_published_dated" CHECK ("offers"."status" <> 'published' or "offers"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_department_code_departments_code_fk" FOREIGN KEY ("department_code") REFERENCES "public"."departments"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_members_company_id_index" ON "company_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "offers_status_index" ON "offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "offers_company_id_index" ON "offers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "offers_department_code_index" ON "offers" USING btree ("department_code");--> statement-breakpoint
CREATE INDEX "offers_occupation_id_index" ON "offers" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "offers_start_date_end_date_index" ON "offers" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "offers_published_at_index" ON "offers" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "offers_languages_index" ON "offers" USING gin ("languages");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_collected_source_url_unique" ON "offers" USING btree ("source_url") WHERE "offers"."origin" = 'collected';--> statement-breakpoint
-- Avant cette migration, aucune annonce n'existait : un offer_id déjà enregistré ne désigne rien.
-- Il est effacé, comme le ferait ON DELETE SET NULL, pour que la clé étrangère puisse être posée.
UPDATE "contact_messages" SET "offer_id" = NULL
WHERE "offer_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "offers" WHERE "offers"."id" = "contact_messages"."offer_id");--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;