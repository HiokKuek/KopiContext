CREATE TABLE "current_update_audit_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "current_update_id" uuid NOT NULL,
  "from_status" "editorial_status" NOT NULL,
  "to_status" "editorial_status" NOT NULL,
  "actor_id" text NOT NULL,
  "reason" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "current_update_audit_records_actor_not_empty" CHECK (length("current_update_audit_records"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "current_update_audit_records" ADD CONSTRAINT "current_update_audit_records_current_update_id_current_updates_id_fk" FOREIGN KEY ("current_update_id") REFERENCES "public"."current_updates"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "current_update_audit_records_update_occurred_idx" ON "current_update_audit_records" USING btree ("current_update_id","occurred_at");
