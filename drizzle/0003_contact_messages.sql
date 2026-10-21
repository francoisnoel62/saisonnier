CREATE TYPE "public"."contact_status" AS ENUM('new', 'handled');--> statement-breakpoint
CREATE TYPE "public"."contact_topic" AS ENUM('collected_offer', 'employer', 'candidate', 'other');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" "contact_topic" NOT NULL,
	"offer_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company_name" text,
	"phone" text,
	"message" text NOT NULL,
	"user_id" text,
	"status" "contact_status" DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	CONSTRAINT "contact_messages_message_length" CHECK (char_length("contact_messages"."message") <= 3000)
);
--> statement-breakpoint
CREATE INDEX "contact_messages_email_created_at_index" ON "contact_messages" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_at_index" ON "contact_messages" USING btree ("status","created_at");