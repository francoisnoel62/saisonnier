ALTER TABLE "offers" ADD COLUMN "additional_info" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "fields_to_confirm" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_additional_info" CHECK (("offers"."additional_info" is null or "offers"."additional_info" ~ '[^[:space:]]') and length("offers"."additional_info") <= 1000);--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_fields_to_confirm" CHECK ("offers"."fields_to_confirm" <@ ARRAY['salary', 'housing', 'meals', 'experience', 'driving_license', 'couples', 'pets', 'languages', 'work_time']::text[] and array_position("offers"."fields_to_confirm", null) is null);--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_confirmable_neutral" CHECK (
      (not ('salary' = any("offers"."fields_to_confirm")) or num_nonnulls("offers"."salary_net_min_cents", "offers"."salary_net_max_cents", "offers"."salary_net_unit", "offers"."salary_gross_min_cents", "offers"."salary_gross_max_cents", "offers"."salary_gross_unit") = 0)
      and (not ('housing' = any("offers"."fields_to_confirm")) or "offers"."housing" = 'unknown')
      and (not ('meals' = any("offers"."fields_to_confirm")) or "offers"."meals" = 'unknown')
      and (not ('experience' = any("offers"."fields_to_confirm")) or "offers"."experience_required" = 'unknown')
      and (not ('driving_license' = any("offers"."fields_to_confirm")) or "offers"."driving_license_required" = 'unknown')
      and (not ('couples' = any("offers"."fields_to_confirm")) or "offers"."couples_welcome" = 'unknown')
      and (not ('pets' = any("offers"."fields_to_confirm")) or "offers"."pets_allowed" = 'unknown')
      and (not ('languages' = any("offers"."fields_to_confirm")) or "offers"."languages_required" = 'unknown')
      and (not ('work_time' = any("offers"."fields_to_confirm")) or "offers"."work_time" = 'unknown'));