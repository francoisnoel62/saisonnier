DROP INDEX "offers_collected_source_url_unique";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "source_published_date" date;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "source_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "first_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "human_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "human_verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_human_verified_by_user_id_user_id_fk" FOREIGN KEY ("human_verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_collected_source_url" ON "offers" USING btree ("source_url") WHERE "offers"."origin" = 'collected';--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_human_verification_collected" CHECK ("offers"."human_verified_at" is null or "offers"."origin" = 'collected');--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_publication_date" CHECK ("offers"."source_published_at" is null or "offers"."source_published_date" is not null);