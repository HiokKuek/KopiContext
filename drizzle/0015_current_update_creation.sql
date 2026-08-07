CREATE TABLE "current_update_creation_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "current_update_id" uuid NOT NULL,
  "actor_id" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "current_update_creation_records_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "current_update_creation_records_actor_not_empty" CHECK (length("current_update_creation_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "current_update_creation_records" ADD CONSTRAINT "current_update_creation_records_current_update_id_current_updates_id_fk" FOREIGN KEY ("current_update_id") REFERENCES "public"."current_updates"("id") ON DELETE restrict ON UPDATE cascade;
