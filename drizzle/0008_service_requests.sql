CREATE TYPE "public"."purchase_format" AS ENUM('single', 'package');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('questionnaire', 'screening', 'human_selection', 'candidate_contact', 'sourcing');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('new', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_scope" AS ENUM('offer', 'campaign', 'establishment');--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requested_by_user_id" text,
	"services" "service_kind"[] NOT NULL,
	"scope" "service_scope" NOT NULL,
	"offer_id" uuid,
	"scope_details" text,
	"purchase_format" "purchase_format" NOT NULL,
	"message" text,
	"status" "service_request_status" DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_text_not_blank" CHECK (("service_requests"."scope_details" is null or "service_requests"."scope_details" ~ '[^[:space:]]') and ("service_requests"."message" is null or "service_requests"."message" ~ '[^[:space:]]') and ("service_requests"."admin_note" is null or "service_requests"."admin_note" ~ '[^[:space:]]')),
	CONSTRAINT "service_requests_services_listed" CHECK (cardinality("service_requests"."services") > 0),
	CONSTRAINT "service_requests_offer_scope" CHECK ("service_requests"."offer_id" is null or "service_requests"."scope" = 'offer'),
	CONSTRAINT "service_requests_message_length" CHECK (char_length("service_requests"."message") <= 3000)
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_company_id_created_at_index" ON "service_requests" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_status_created_at_index" ON "service_requests" USING btree ("status","created_at");