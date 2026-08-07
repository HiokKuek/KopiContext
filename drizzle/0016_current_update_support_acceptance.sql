CREATE TABLE "current_update_support_acceptance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "current_update_id" uuid NOT NULL,
  "accepted_source_id" uuid NOT NULL,
  "current_update_support_id" uuid NOT NULL,
  "actor_id" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "current_update_support_acceptance_records_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "current_update_support_acceptance_records_actor_not_empty" CHECK (length("current_update_support_acceptance_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "current_update_support_acceptance_records" ADD CONSTRAINT "current_update_support_acceptance_records_current_update_id_current_updates_id_fk" FOREIGN KEY ("current_update_id") REFERENCES "public"."current_updates"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "current_update_support_acceptance_records" ADD CONSTRAINT "current_update_support_acceptance_records_accepted_source_id_accepted_sources_id_fk" FOREIGN KEY ("accepted_source_id") REFERENCES "public"."accepted_sources"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "current_update_support_acceptance_records" ADD CONSTRAINT "current_update_support_acceptance_records_current_update_support_id_current_update_supports_id_fk" FOREIGN KEY ("current_update_support_id") REFERENCES "public"."current_update_supports"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "current_update_support_acceptance_records_update_occurred_idx" ON "current_update_support_acceptance_records" USING btree ("current_update_id","occurred_at");
