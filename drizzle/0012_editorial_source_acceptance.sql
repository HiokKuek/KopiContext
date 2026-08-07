CREATE TABLE "editorial_source_acceptance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"accepted_source_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_source_acceptance_records_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "editorial_source_acceptance_records_actor_not_empty" CHECK (length("editorial_source_acceptance_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "editorial_source_acceptance_records" ADD CONSTRAINT "editorial_source_acceptance_records_accepted_source_id_accepted_sources_id_fk" FOREIGN KEY ("accepted_source_id") REFERENCES "public"."accepted_sources"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "editorial_source_acceptance_records_source_occurred_idx" ON "editorial_source_acceptance_records" USING btree ("accepted_source_id","occurred_at");
