CREATE TYPE "public"."proposal_decision_outcome" AS ENUM('accepted');--> statement-breakpoint
CREATE TYPE "public"."proposal_decision_part" AS ENUM('classification-and-draft');--> statement-breakpoint
CREATE TABLE "proposal_decision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_submission_id" uuid NOT NULL,
	"proposal_output_fingerprint" text NOT NULL,
	"proposal_part" "proposal_decision_part" NOT NULL,
	"outcome" "proposal_decision_outcome" NOT NULL,
	"actor_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason_or_note" text,
	"topic_id" uuid NOT NULL,
	"briefing_id" uuid NOT NULL,
	"briefing_revision_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "proposal_decision_records_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "proposal_decision_records_actor_not_empty" CHECK (length("proposal_decision_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "proposal_decision_records" ADD CONSTRAINT "proposal_decision_records_source_submission_id_source_submissions_id_fk" FOREIGN KEY ("source_submission_id") REFERENCES "public"."source_submissions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_decision_records" ADD CONSTRAINT "proposal_decision_records_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_decision_records" ADD CONSTRAINT "proposal_decision_records_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_decision_records" ADD CONSTRAINT "proposal_decision_records_briefing_revision_id_briefing_revisions_id_fk" FOREIGN KEY ("briefing_revision_id") REFERENCES "public"."briefing_revisions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "proposal_decision_records_submission_occurred_idx" ON "proposal_decision_records" USING btree ("source_submission_id","occurred_at");