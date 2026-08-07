ALTER TABLE "source_submissions" ADD COLUMN "processing_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "processing_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "processing_worker_id" text;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD COLUMN "last_processing_error" text;--> statement-breakpoint
CREATE INDEX "source_submissions_worker_claim_idx" ON "source_submissions" USING btree ("processing_status","next_attempt_at");