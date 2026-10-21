CREATE TABLE "candidate_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"city" text,
	"cv_pathname" text,
	"cv_filename" text,
	"cv_size" integer,
	"cv_uploaded_at" timestamp with time zone,
	"cover_letter_pathname" text,
	"cover_letter_filename" text,
	"cover_letter_uploaded_at" timestamp with time zone,
	"application_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_text_not_blank" CHECK (("candidate_profiles"."phone" is null or "candidate_profiles"."phone" ~ '[^[:space:]]') and ("candidate_profiles"."city" is null or "candidate_profiles"."city" ~ '[^[:space:]]') and ("candidate_profiles"."cv_pathname" is null or "candidate_profiles"."cv_pathname" ~ '[^[:space:]]') and ("candidate_profiles"."cv_filename" is null or "candidate_profiles"."cv_filename" ~ '[^[:space:]]') and ("candidate_profiles"."cover_letter_pathname" is null or "candidate_profiles"."cover_letter_pathname" ~ '[^[:space:]]') and ("candidate_profiles"."cover_letter_filename" is null or "candidate_profiles"."cover_letter_filename" ~ '[^[:space:]]') and ("candidate_profiles"."application_message" is null or "candidate_profiles"."application_message" ~ '[^[:space:]]')),
	CONSTRAINT "candidate_profiles_cv_complete" CHECK (num_nulls("candidate_profiles"."cv_pathname", "candidate_profiles"."cv_filename", "candidate_profiles"."cv_size", "candidate_profiles"."cv_uploaded_at") in (0, 4)),
	CONSTRAINT "candidate_profiles_cover_letter_complete" CHECK (num_nulls("candidate_profiles"."cover_letter_pathname", "candidate_profiles"."cover_letter_filename", "candidate_profiles"."cover_letter_uploaded_at") in (0, 3)),
	CONSTRAINT "candidate_profiles_cv_size" CHECK ("candidate_profiles"."cv_size" between 1 and 4194304),
	CONSTRAINT "candidate_profiles_message_length" CHECK (char_length("candidate_profiles"."application_message") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;