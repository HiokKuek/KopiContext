CREATE TABLE "editorial_claim_creation_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "briefing_id" uuid NOT NULL,
  "briefing_revision_id" uuid NOT NULL,
  "accepted_source_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "claim_support_id" uuid NOT NULL,
  "actor_id" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "editorial_claim_creation_records_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "editorial_claim_creation_records_actor_not_empty" CHECK (length("editorial_claim_creation_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "editorial_claim_creation_records" ADD CONSTRAINT "editorial_claim_creation_records_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "editorial_claim_creation_records" ADD CONSTRAINT "editorial_claim_creation_records_briefing_revision_id_briefing_revisions_id_fk" FOREIGN KEY ("briefing_revision_id") REFERENCES "public"."briefing_revisions"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "editorial_claim_creation_records" ADD CONSTRAINT "editorial_claim_creation_records_accepted_source_id_accepted_sources_id_fk" FOREIGN KEY ("accepted_source_id") REFERENCES "public"."accepted_sources"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "editorial_claim_creation_records" ADD CONSTRAINT "editorial_claim_creation_records_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "editorial_claim_creation_records" ADD CONSTRAINT "editorial_claim_creation_records_claim_support_id_claim_supports_id_fk" FOREIGN KEY ("claim_support_id") REFERENCES "public"."claim_supports"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "editorial_claim_creation_records_briefing_occurred_idx" ON "editorial_claim_creation_records" USING btree ("briefing_id","occurred_at");
