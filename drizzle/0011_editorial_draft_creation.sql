CREATE TABLE "editorial_draft_creation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"briefing_id" uuid NOT NULL,
	"briefing_revision_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_draft_creation_records_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "editorial_draft_creation_records_actor_not_empty" CHECK (length("editorial_draft_creation_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "editorial_draft_creation_records" ADD CONSTRAINT "editorial_draft_creation_records_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "editorial_draft_creation_records" ADD CONSTRAINT "editorial_draft_creation_records_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "editorial_draft_creation_records" ADD CONSTRAINT "editorial_draft_creation_records_briefing_revision_id_briefing_revisions_id_fk" FOREIGN KEY ("briefing_revision_id") REFERENCES "public"."briefing_revisions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "editorial_draft_creation_records_topic_occurred_idx" ON "editorial_draft_creation_records" USING btree ("topic_id","occurred_at");
