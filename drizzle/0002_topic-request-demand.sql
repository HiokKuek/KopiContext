CREATE TABLE "topic_request_demands" (
	"requested_topic" text PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"first_requested_at" timestamp with time zone NOT NULL,
	"last_requested_at" timestamp with time zone NOT NULL,
	CONSTRAINT "topic_request_demands_count_positive" CHECK ("topic_request_demands"."request_count" > 0),
	CONSTRAINT "topic_request_demands_timestamp_order" CHECK ("topic_request_demands"."first_requested_at" <= "topic_request_demands"."last_requested_at")
);
--> statement-breakpoint
CREATE INDEX "topic_request_demands_last_requested_idx" ON "topic_request_demands" USING btree ("last_requested_at");