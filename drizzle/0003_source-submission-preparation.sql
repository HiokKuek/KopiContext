CREATE TYPE "public"."source_preparation_result_state" AS ENUM('prepared', 'needs-review', 'duplicate', 'failed');--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "canonical_identifier" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "preparation_result_state" "source_preparation_result_state";--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "preparation_failure" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "duplicate_of_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_duplicate_of_submission_id_source_submissions_id_fk" FOREIGN KEY ("duplicate_of_submission_id") REFERENCES "public"."source_submissions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "source_submissions_canonical_identifier_idx" ON "source_submissions" USING btree ("canonical_identifier");--> statement-breakpoint
CREATE INDEX "source_submissions_duplicate_of_idx" ON "source_submissions" USING btree ("duplicate_of_submission_id");--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_terminal_result_failure_pair" CHECK (("source_submissions"."preparation_result_state" <> 'failed' OR "source_submissions"."preparation_failure" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_duplicate_target_required" CHECK (("source_submissions"."preparation_result_state" <> 'duplicate' OR "source_submissions"."duplicate_of_submission_id" IS NOT NULL));