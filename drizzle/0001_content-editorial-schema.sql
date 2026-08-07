CREATE TYPE "public"."briefing_revision_origin" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('candidate', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."claim_support_kind" AS ENUM('direct', 'contextual');--> statement-breakpoint
CREATE TYPE "public"."editorial_status" AS ENUM('draft', 'needs-verification', 'in-editorial-review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."source_submission_kind" AS ENUM('url', 'document', 'transcript');--> statement-breakpoint
CREATE TYPE "public"."source_submission_status" AS ENUM('submitted', 'processing', 'ready-for-review', 'escalated', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('active', 'merged', 'archived');--> statement-breakpoint
CREATE TABLE "accepted_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accepted_from_submission_id" uuid,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"source_type" text NOT NULL,
	"canonical_url" text NOT NULL,
	"external_identifier" text,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"relation" text NOT NULL,
	"rights_note" text NOT NULL,
	"accepted_by" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accepted_sources_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "briefing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"template_version" text NOT NULL,
	"content" jsonb NOT NULL,
	"origin" "briefing_revision_origin" NOT NULL,
	"created_by" text NOT NULL,
	"source_submission_id" uuid,
	"ai_provider" text,
	"ai_model" text,
	"prompt_version" text,
	"input_provenance" jsonb,
	"generation_output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefing_revisions_briefing_sequence_unique" UNIQUE("briefing_id","sequence"),
	CONSTRAINT "briefing_revisions_sequence_positive" CHECK ("briefing_revisions"."sequence" > 0),
	CONSTRAINT "briefing_revisions_agent_provenance" CHECK (("briefing_revisions"."origin" <> 'agent' OR ("briefing_revisions"."ai_provider" IS NOT NULL AND "briefing_revisions"."ai_model" IS NOT NULL AND "briefing_revisions"."prompt_version" IS NOT NULL AND "briefing_revisions"."input_provenance" IS NOT NULL AND "briefing_revisions"."generation_output" IS NOT NULL))),
	CONSTRAINT "briefing_revisions_human_has_no_ai_provenance" CHECK (("briefing_revisions"."origin" <> 'human' OR ("briefing_revisions"."ai_provider" IS NULL AND "briefing_revisions"."ai_model" IS NULL AND "briefing_revisions"."prompt_version" IS NULL AND "briefing_revisions"."input_provenance" IS NULL AND "briefing_revisions"."generation_output" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"template_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefings_topic_id_unique" UNIQUE("topic_id")
);
--> statement-breakpoint
CREATE TABLE "claim_supports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"accepted_source_id" uuid NOT NULL,
	"kind" "claim_support_kind" DEFAULT 'direct' NOT NULL,
	"locator" text,
	"excerpt" text,
	"rationale" text,
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_supports_claim_source_unique" UNIQUE("claim_id","accepted_source_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_revision_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"status" "claim_status" DEFAULT 'candidate' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_audit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_id" uuid NOT NULL,
	"briefing_revision_id" uuid NOT NULL,
	"from_status" "editorial_status" NOT NULL,
	"to_status" "editorial_status" NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "editorial_audit_records_status_changes" CHECK ("editorial_audit_records"."from_status" <> "editorial_audit_records"."to_status")
);
--> statement-breakpoint
CREATE TABLE "source_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "source_submission_kind" NOT NULL,
	"original_identifier" text NOT NULL,
	"original_url" text,
	"content_fingerprint" text,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retrieved_at" timestamp with time zone,
	"rights_note" text NOT NULL,
	"processing_status" "source_submission_status" DEFAULT 'submitted' NOT NULL,
	"proposed_topic_id" uuid,
	"proposed_subtopic" text,
	"classification_confidence" numeric(4, 3),
	"classification_rationale" text,
	"processing_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processor_provider" text,
	"processor_model" text,
	"prompt_version" text,
	"processor_input_provenance" jsonb,
	"processor_output" jsonb,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_submissions_confidence_in_range" CHECK (("source_submissions"."classification_confidence" IS NULL OR ("source_submissions"."classification_confidence" >= 0 AND "source_submissions"."classification_confidence" <= 1))),
	CONSTRAINT "source_submissions_processing_provenance_complete" CHECK (("source_submissions"."processor_provider" IS NULL OR ("source_submissions"."processor_model" IS NOT NULL AND "source_submissions"."prompt_version" IS NOT NULL AND "source_submissions"."processor_input_provenance" IS NOT NULL AND "source_submissions"."processor_output" IS NOT NULL AND "source_submissions"."processed_at" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "topic_status" DEFAULT 'active' NOT NULL,
	"merged_into_topic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug"),
	CONSTRAINT "topics_merge_target_required" CHECK (("topics"."status" <> 'merged' OR "topics"."merged_into_topic_id" IS NOT NULL)),
	CONSTRAINT "topics_merge_target_only_when_merged" CHECK (("topics"."status" = 'merged' OR "topics"."merged_into_topic_id" IS NULL)),
	CONSTRAINT "topics_cannot_merge_into_self" CHECK (("topics"."merged_into_topic_id" IS NULL OR "topics"."merged_into_topic_id" <> "topics"."id"))
);
--> statement-breakpoint
ALTER TABLE "accepted_sources" ADD CONSTRAINT "accepted_sources_accepted_from_submission_id_source_submissions_id_fk" FOREIGN KEY ("accepted_from_submission_id") REFERENCES "public"."source_submissions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "briefing_revisions" ADD CONSTRAINT "briefing_revisions_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "briefing_revisions" ADD CONSTRAINT "briefing_revisions_source_submission_id_source_submissions_id_fk" FOREIGN KEY ("source_submission_id") REFERENCES "public"."source_submissions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claim_supports" ADD CONSTRAINT "claim_supports_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claim_supports" ADD CONSTRAINT "claim_supports_accepted_source_id_accepted_sources_id_fk" FOREIGN KEY ("accepted_source_id") REFERENCES "public"."accepted_sources"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_briefing_revision_id_briefing_revisions_id_fk" FOREIGN KEY ("briefing_revision_id") REFERENCES "public"."briefing_revisions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "editorial_audit_records" ADD CONSTRAINT "editorial_audit_records_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "editorial_audit_records" ADD CONSTRAINT "editorial_audit_records_briefing_revision_id_briefing_revisions_id_fk" FOREIGN KEY ("briefing_revision_id") REFERENCES "public"."briefing_revisions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_submissions" ADD CONSTRAINT "source_submissions_proposed_topic_id_topics_id_fk" FOREIGN KEY ("proposed_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "accepted_sources_publisher_idx" ON "accepted_sources" USING btree ("publisher");--> statement-breakpoint
CREATE INDEX "briefing_revisions_briefing_created_idx" ON "briefing_revisions" USING btree ("briefing_id","created_at");--> statement-breakpoint
CREATE INDEX "briefings_status_idx" ON "briefings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "claim_supports_source_idx" ON "claim_supports" USING btree ("accepted_source_id");--> statement-breakpoint
CREATE INDEX "claims_revision_status_idx" ON "claims" USING btree ("briefing_revision_id","status");--> statement-breakpoint
CREATE INDEX "editorial_audit_records_briefing_occurred_idx" ON "editorial_audit_records" USING btree ("briefing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "editorial_audit_records_revision_idx" ON "editorial_audit_records" USING btree ("briefing_revision_id");--> statement-breakpoint
CREATE INDEX "source_submissions_status_idx" ON "source_submissions" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "source_submissions_fingerprint_idx" ON "source_submissions" USING btree ("content_fingerprint");--> statement-breakpoint
CREATE INDEX "topics_status_idx" ON "topics" USING btree ("status");