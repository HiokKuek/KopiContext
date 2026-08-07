CREATE TYPE "public"."anonymous_analytics_event_type" AS ENUM('page-view', 'search', 'search-result-click', 'no-result-search', 'topic-view', 'section-expanded', 'current-update-opened', 'related-topic-click', 'share', 'topic-request', 'feedback');--> statement-breakpoint
CREATE TABLE "anonymous_analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "anonymous_analytics_event_type" NOT NULL,
	"session_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text,
	"path" text,
	"query" text,
	"topic_slug" text,
	"result_position" integer,
	"section_id" text,
	"update_id" text,
	"related_topic_slug" text,
	"share_method" text,
	"requested_topic" text,
	"feedback_sentiment" text,
	CONSTRAINT "anonymous_analytics_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "anonymous_analytics_events_session_not_empty" CHECK (length("anonymous_analytics_events"."session_id") > 0)
);
--> statement-breakpoint
CREATE INDEX "anonymous_analytics_events_received_at_idx" ON "anonymous_analytics_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "anonymous_analytics_events_type_occurred_at_idx" ON "anonymous_analytics_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "anonymous_analytics_events_topic_occurred_at_idx" ON "anonymous_analytics_events" USING btree ("topic_slug","occurred_at");