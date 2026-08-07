CREATE TABLE "current_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic_id" uuid NOT NULL,
  "briefing_id" uuid,
  "status" "editorial_status" DEFAULT 'draft' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "current_updates_approval_pair" CHECK (("current_updates"."approved_by" IS NULL) = ("current_updates"."approved_at" IS NULL)),
  CONSTRAINT "current_updates_published_requires_approval" CHECK ("current_updates"."status" <> 'published' OR ("current_updates"."approved_by" IS NOT NULL AND "current_updates"."published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "current_updates" ADD CONSTRAINT "current_updates_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "current_updates" ADD CONSTRAINT "current_updates_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE TABLE "current_update_supports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "current_update_id" uuid NOT NULL,
  "accepted_source_id" uuid NOT NULL,
  "excerpt" text,
  "rationale" text,
  "added_by" text NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "current_update_supports_update_source_unique" UNIQUE("current_update_id","accepted_source_id")
);
--> statement-breakpoint
ALTER TABLE "current_update_supports" ADD CONSTRAINT "current_update_supports_current_update_id_current_updates_id_fk" FOREIGN KEY ("current_update_id") REFERENCES "public"."current_updates"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "current_update_supports" ADD CONSTRAINT "current_update_supports_accepted_source_id_accepted_sources_id_fk" FOREIGN KEY ("accepted_source_id") REFERENCES "public"."accepted_sources"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "current_updates_topic_effective_idx" ON "current_updates" USING btree ("topic_id","effective_at");
--> statement-breakpoint
CREATE INDEX "current_updates_status_effective_idx" ON "current_updates" USING btree ("status","effective_at");
--> statement-breakpoint
CREATE INDEX "current_update_supports_source_idx" ON "current_update_supports" USING btree ("accepted_source_id");
