CREATE TABLE "offer_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"commune_name" text NOT NULL,
	"commune_insee_code" text,
	"postal_code" text,
	"department_code" text NOT NULL,
	"location_details" text,
	CONSTRAINT "offer_locations_order" UNIQUE("offer_id","position"),
	CONSTRAINT "offer_locations_position_positive" CHECK ("offer_locations"."position" >= 1),
	CONSTRAINT "offer_locations_text_not_blank" CHECK (("offer_locations"."commune_name" is null or "offer_locations"."commune_name" ~ '[^[:space:]]') and ("offer_locations"."commune_insee_code" is null or "offer_locations"."commune_insee_code" ~ '[^[:space:]]') and ("offer_locations"."postal_code" is null or "offer_locations"."postal_code" ~ '[^[:space:]]') and ("offer_locations"."location_details" is null or "offer_locations"."location_details" ~ '[^[:space:]]')),
	CONSTRAINT "offer_locations_commune_in_department" CHECK ("offer_locations"."commune_insee_code" is null or starts_with("offer_locations"."commune_insee_code", "offer_locations"."department_code"))
);
--> statement-breakpoint
ALTER TABLE "offer_locations" ADD CONSTRAINT "offer_locations_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_locations" ADD CONSTRAINT "offer_locations_department_code_departments_code_fk" FOREIGN KEY ("department_code") REFERENCES "public"."departments"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_locations_known_commune" ON "offer_locations" USING btree ("offer_id","commune_insee_code") WHERE "offer_locations"."commune_insee_code" is not null;--> statement-breakpoint
CREATE INDEX "offer_locations_department_code_index" ON "offer_locations" USING btree ("department_code");--> statement-breakpoint
CREATE INDEX "offer_locations_offer_id_index" ON "offer_locations" USING btree ("offer_id");