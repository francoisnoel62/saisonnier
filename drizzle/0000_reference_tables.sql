CREATE TABLE "blocked_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_domains_domain_normalized" CHECK ("blocked_domains"."domain" = lower("blocked_domains"."domain") and "blocked_domains"."domain" not like 'www.%')
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region_code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"family" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "occupations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "departments_region_code_index" ON "departments" USING btree ("region_code");