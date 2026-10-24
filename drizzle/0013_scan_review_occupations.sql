CREATE TABLE "occupation_aliases" (
	"normalized_label" text PRIMARY KEY NOT NULL,
	"occupation_id" uuid NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occupation_aliases_label_not_blank" CHECK (("occupation_aliases"."normalized_label" is null or "occupation_aliases"."normalized_label" ~ '[^[:space:]]'))
);
--> statement-breakpoint
ALTER TABLE "occupation_aliases" ADD CONSTRAINT "occupation_aliases_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_aliases" ADD CONSTRAINT "occupation_aliases_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;