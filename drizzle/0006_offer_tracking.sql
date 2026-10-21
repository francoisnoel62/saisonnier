CREATE TABLE "offer_tracking" (
	"user_id" text NOT NULL,
	"offer_id" uuid NOT NULL,
	"saved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_tracking_user_id_offer_id_pk" PRIMARY KEY("user_id","offer_id"),
	CONSTRAINT "offer_tracking_not_empty" CHECK ("offer_tracking"."saved_at" is not null or "offer_tracking"."applied_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "offer_tracking" ADD CONSTRAINT "offer_tracking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_tracking" ADD CONSTRAINT "offer_tracking_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_tracking_offer_id_index" ON "offer_tracking" USING btree ("offer_id");