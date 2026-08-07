import {
  check,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The persistence representation of the editorial workflow. Its values match
 * the application seam in `modules/editorial`; database constraints protect
 * the vocabulary while the application owns the transition rules.
 */
export const editorialStatus = pgEnum("editorial_status", [
  "draft",
  "needs-verification",
  "in-editorial-review",
  "approved",
  "published",
  "archived",
]);

export const topicStatus = pgEnum("topic_status", ["active", "merged", "archived"]);
export const sourceSubmissionKind = pgEnum("source_submission_kind", [
  "url",
  "document",
  "transcript",
]);
export const sourceSubmissionStatus = pgEnum("source_submission_status", [
  "submitted",
  "processing",
  "ready-for-review",
  "escalated",
  "rejected",
]);
export const sourcePreparationResultState = pgEnum("source_preparation_result_state", [
  "prepared",
  "needs-review",
  "duplicate",
  "failed",
]);
export const briefingRevisionOrigin = pgEnum("briefing_revision_origin", ["human", "agent"]);
export const claimStatus = pgEnum("claim_status", ["candidate", "verified", "rejected"]);
export const claimSupportKind = pgEnum("claim_support_kind", ["direct", "contextual"]);
export const proposalDecisionPart = pgEnum("proposal_decision_part", ["classification-and-draft", "source"]);
export const proposalDecisionOutcome = pgEnum("proposal_decision_outcome", ["accepted"]);
export const anonymousAnalyticsEventType = pgEnum("anonymous_analytics_event_type", [
  "page-view",
  "search",
  "search-result-click",
  "no-result-search",
  "topic-view",
  "section-expanded",
  "current-update-opened",
  "related-topic-click",
  "share",
  "topic-request",
  "feedback",
]);

const createdAt = timestamp("created_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull();

/** The canonical subject a reader can discover and that a Briefing explains. */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: topicStatus("status").default("active").notNull(),
    mergedIntoTopicId: uuid("merged_into_topic_id"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("topics_status_idx").on(table.status),
    check(
      "topics_merge_target_required",
      sql`(${table.status} <> 'merged' OR ${table.mergedIntoTopicId} IS NOT NULL)`,
    ),
    check(
      "topics_merge_target_only_when_merged",
      sql`(${table.status} = 'merged' OR ${table.mergedIntoTopicId} IS NULL)`,
    ),
    check(
      "topics_cannot_merge_into_self",
      sql`(${table.mergedIntoTopicId} IS NULL OR ${table.mergedIntoTopicId} <> ${table.id})`,
    ),
  ],
);

/**
 * Anonymous requests are folded into a compact discovery aggregate. There is
 * intentionally no request row, reader/session identifier, header, network
 * address, user agent, or free-form context to turn this into a profile.
 */
export const topicRequestDemands = pgTable(
  "topic_request_demands",
  {
    requestedTopic: text("requested_topic").primaryKey(),
    requestCount: integer("request_count").default(0).notNull(),
    firstRequestedAt: timestamp("first_requested_at", { withTimezone: true, mode: "date" }).notNull(),
    lastRequestedAt: timestamp("last_requested_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("topic_request_demands_last_requested_idx").on(table.lastRequestedAt),
    check("topic_request_demands_count_positive", sql`${table.requestCount} > 0`),
    check(
      "topic_request_demands_timestamp_order",
      sql`${table.firstRequestedAt} <= ${table.lastRequestedAt}`,
    ),
  ],
);

/**
 * A deliberately narrow first-party event log. Its columns are the complete
 * allow-list from `modules/analytics`, so request/IP/header/device metadata
 * has no persistence destination. Session IDs are opaque and rotate in the
 * browser; events are retained only long enough to produce aggregate insight.
 */
export const anonymousAnalyticsEvents = pgTable(
  "anonymous_analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: anonymousAnalyticsEventType("event_type").notNull(),
    sessionId: text("session_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    path: text("path"),
    query: text("query"),
    topicSlug: text("topic_slug"),
    resultPosition: integer("result_position"),
    sectionId: text("section_id"),
    updateId: text("update_id"),
    relatedTopicSlug: text("related_topic_slug"),
    shareMethod: text("share_method"),
    requestedTopic: text("requested_topic"),
    feedbackSentiment: text("feedback_sentiment"),
  },
  (table) => [
    index("anonymous_analytics_events_received_at_idx").on(table.receivedAt),
    index("anonymous_analytics_events_type_occurred_at_idx").on(table.eventType, table.occurredAt),
    index("anonymous_analytics_events_topic_occurred_at_idx").on(table.topicSlug, table.occurredAt),
    check("anonymous_analytics_events_session_not_empty", sql`length(${table.sessionId}) > 0`),
  ],
);

/**
 * The editorial aggregate for an evergreen explanation. The current state is
 * stored here; immutable Briefing revisions carry the actual draft content.
 */
export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: editorialStatus("status").default("draft").notNull(),
    templateVersion: text("template_version").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("briefings_topic_id_unique").on(table.topicId),
    index("briefings_status_idx").on(table.status),
  ],
);

/**
 * An immutable revision proposed by a human or agent. `content` deliberately
 * remains structured JSON because the versioned Briefing Template owns its
 * shape; a migration is not needed for every template field change.
 */
export const briefingRevisions = pgTable(
  "briefing_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    briefingId: uuid("briefing_id")
      .notNull()
      .references(() => briefings.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sequence: integer("sequence").notNull(),
    templateVersion: text("template_version").notNull(),
    content: jsonb("content").notNull(),
    origin: briefingRevisionOrigin("origin").notNull(),
    createdBy: text("created_by").notNull(),
    sourceSubmissionId: uuid("source_submission_id").references(() => sourceSubmissions.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    aiProvider: text("ai_provider"),
    aiModel: text("ai_model"),
    promptVersion: text("prompt_version"),
    inputProvenance: jsonb("input_provenance"),
    generationOutput: jsonb("generation_output"),
    createdAt,
  },
  (table) => [
    unique("briefing_revisions_briefing_sequence_unique").on(table.briefingId, table.sequence),
    index("briefing_revisions_briefing_created_idx").on(table.briefingId, table.createdAt),
    check("briefing_revisions_sequence_positive", sql`${table.sequence} > 0`),
    check(
      "briefing_revisions_agent_provenance",
      sql`(${table.origin} <> 'agent' OR (${table.aiProvider} IS NOT NULL AND ${table.aiModel} IS NOT NULL AND ${table.promptVersion} IS NOT NULL AND ${table.inputProvenance} IS NOT NULL AND ${table.generationOutput} IS NOT NULL))`,
    ),
    check(
      "briefing_revisions_human_has_no_ai_provenance",
      sql`(${table.origin} <> 'human' OR (${table.aiProvider} IS NULL AND ${table.aiModel} IS NULL AND ${table.promptVersion} IS NULL AND ${table.inputProvenance} IS NULL AND ${table.generationOutput} IS NULL))`,
    ),
  ],
);

/**
 * Material awaiting assessment. It preserves original material and processing
 * provenance but cannot support a Claim unless it becomes an Accepted Source.
 */
export const sourceSubmissions = pgTable(
  "source_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Durable command key; the preparation worker never repeats a completed command. */
    idempotencyKey: text("idempotency_key").unique(),
    kind: sourceSubmissionKind("kind").notNull(),
    originalIdentifier: text("original_identifier").notNull(),
    originalUrl: text("original_url"),
    submittedTranscriptText: text("submitted_transcript_text"),
    canonicalIdentifier: text("canonical_identifier"),
    contentFingerprint: text("content_fingerprint"),
    submittedBy: text("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true, mode: "date" }),
    rightsNote: text("rights_note").notNull(),
    processingStatus: sourceSubmissionStatus("processing_status")
      .default("submitted")
      .notNull(),
    processingAttemptCount: integer("processing_attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true, mode: "date" }),
    processingLeaseExpiresAt: timestamp("processing_lease_expires_at", { withTimezone: true, mode: "date" }),
    processingWorkerId: text("processing_worker_id"),
    lastProcessingError: text("last_processing_error"),
    preparationResultState: sourcePreparationResultState("preparation_result_state"),
    preparationFailure: text("preparation_failure"),
    duplicateOfSubmissionId: uuid("duplicate_of_submission_id").references((): AnyPgColumn => sourceSubmissions.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    proposedTopicId: uuid("proposed_topic_id").references(() => topics.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    proposedSubtopic: text("proposed_subtopic"),
    classificationConfidence: numeric("classification_confidence", { precision: 4, scale: 3 }),
    classificationRationale: text("classification_rationale"),
    processingHistory: jsonb("processing_history").default([]).notNull(),
    processorProvider: text("processor_provider"),
    processorModel: text("processor_model"),
    promptVersion: text("prompt_version"),
    processorInputProvenance: jsonb("processor_input_provenance"),
    processorOutput: jsonb("processor_output"),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("source_submissions_status_idx").on(table.processingStatus),
    index("source_submissions_worker_claim_idx").on(table.processingStatus, table.nextAttemptAt),
    index("source_submissions_fingerprint_idx").on(table.contentFingerprint),
    index("source_submissions_canonical_identifier_idx").on(table.canonicalIdentifier),
    index("source_submissions_duplicate_of_idx").on(table.duplicateOfSubmissionId),
    check(
      "source_submissions_confidence_in_range",
      sql`(${table.classificationConfidence} IS NULL OR (${table.classificationConfidence} >= 0 AND ${table.classificationConfidence} <= 1))`,
    ),
    check(
      "source_submissions_transcript_text_kind",
      sql`(${table.submittedTranscriptText} IS NULL OR ${table.kind} = 'transcript')`,
    ),
    check(
      "source_submissions_processing_provenance_complete",
      sql`(${table.processorProvider} IS NULL OR (${table.processorModel} IS NOT NULL AND ${table.promptVersion} IS NOT NULL AND ${table.processorInputProvenance} IS NOT NULL AND ${table.processorOutput} IS NOT NULL AND ${table.processedAt} IS NOT NULL))`,
    ),
    check(
      "source_submissions_terminal_result_failure_pair",
      sql`(${table.preparationResultState} <> 'failed' OR ${table.preparationFailure} IS NOT NULL)`,
    ),
    check(
      "source_submissions_duplicate_target_required",
      sql`(${table.preparationResultState} <> 'duplicate' OR ${table.duplicateOfSubmissionId} IS NOT NULL)`,
    ),
  ],
);

/** A source the editor has explicitly accepted as evidence. */
export const acceptedSources = pgTable(
  "accepted_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    acceptedFromSubmissionId: uuid("accepted_from_submission_id").references(
      () => sourceSubmissions.id,
      { onDelete: "restrict", onUpdate: "cascade" },
    ),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    sourceType: text("source_type").notNull(),
    canonicalUrl: text("canonical_url").notNull().unique(),
    externalIdentifier: text("external_identifier"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true, mode: "date" }).notNull(),
    relation: text("relation").notNull(),
    rightsNote: text("rights_note").notNull(),
    acceptedBy: text("accepted_by").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("accepted_sources_publisher_idx").on(table.publisher)],
);

/** A factual statement in one specific Briefing revision. */
export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    briefingRevisionId: uuid("briefing_revision_id")
      .notNull()
      .references(() => briefingRevisions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    statement: text("statement").notNull(),
    status: claimStatus("status").default("candidate").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("claims_revision_status_idx").on(table.briefingRevisionId, table.status)],
);

/** The auditable many-to-many relationship between a Claim and an Accepted Source. */
export const claimSupports = pgTable(
  "claim_supports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade", onUpdate: "cascade" }),
    acceptedSourceId: uuid("accepted_source_id")
      .notNull()
      .references(() => acceptedSources.id, { onDelete: "restrict", onUpdate: "cascade" }),
    kind: claimSupportKind("kind").default("direct").notNull(),
    locator: text("locator"),
    excerpt: text("excerpt"),
    rationale: text("rationale"),
    addedBy: text("added_by").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("claim_supports_claim_source_unique").on(table.claimId, table.acceptedSourceId),
    index("claim_supports_source_idx").on(table.acceptedSourceId),
  ],
);

/**
 * An append-only editorial record. The application writes it in the same
 * transaction as a successful Briefing status transition.
 */
export const editorialAuditRecords = pgTable(
  "editorial_audit_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    briefingId: uuid("briefing_id")
      .notNull()
      .references(() => briefings.id, { onDelete: "restrict", onUpdate: "cascade" }),
    briefingRevisionId: uuid("briefing_revision_id")
      .notNull()
      .references(() => briefingRevisions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fromStatus: editorialStatus("from_status").notNull(),
    toStatus: editorialStatus("to_status").notNull(),
    actorId: text("actor_id").notNull(),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
  },
  (table) => [
    index("editorial_audit_records_briefing_occurred_idx").on(table.briefingId, table.occurredAt),
    index("editorial_audit_records_revision_idx").on(table.briefingRevisionId),
    check("editorial_audit_records_status_changes", sql`${table.fromStatus} <> ${table.toStatus}`),
  ],
);

/**
 * Append-only decisions on agent-prepared material. This is distinct from a
 * Briefing workflow audit: it records the trusted editor's acceptance of a
 * particular proposal output before the resulting Draft can enter review.
 */
export const proposalDecisionRecords = pgTable(
  "proposal_decision_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    sourceSubmissionId: uuid("source_submission_id")
      .notNull()
      .references(() => sourceSubmissions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    proposalOutputFingerprint: text("proposal_output_fingerprint").notNull(),
    proposalPart: proposalDecisionPart("proposal_part").notNull(),
    outcome: proposalDecisionOutcome("outcome").notNull(),
    actorId: text("actor_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    reasonOrNote: text("reason_or_note"),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "restrict", onUpdate: "cascade" }),
    briefingId: uuid("briefing_id").references(() => briefings.id, { onDelete: "restrict", onUpdate: "cascade" }),
    briefingRevisionId: uuid("briefing_revision_id").references(() => briefingRevisions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    acceptedSourceId: uuid("accepted_source_id").references(() => acceptedSources.id, { onDelete: "restrict", onUpdate: "cascade" }),
    metadata: jsonb("metadata").default({}).notNull(),
  },
  (table) => [
    index("proposal_decision_records_submission_occurred_idx").on(table.sourceSubmissionId, table.occurredAt),
    check("proposal_decision_records_actor_not_empty", sql`length(${table.actorId}) > 0`),
    check(
      "proposal_decision_records_phase_a_results",
      sql`(${table.proposalPart} <> 'classification-and-draft' OR (${table.topicId} IS NOT NULL AND ${table.briefingId} IS NOT NULL AND ${table.briefingRevisionId} IS NOT NULL AND ${table.acceptedSourceId} IS NULL))`,
    ),
    check(
      "proposal_decision_records_source_results",
      sql`(${table.proposalPart} <> 'source' OR (${table.acceptedSourceId} IS NOT NULL AND ${table.topicId} IS NULL AND ${table.briefingId} IS NULL AND ${table.briefingRevisionId} IS NULL))`,
    ),
  ],
);

export type TopicRow = typeof topics.$inferSelect;
export type NewTopicRow = typeof topics.$inferInsert;
export type TopicRequestDemandRow = typeof topicRequestDemands.$inferSelect;
export type NewTopicRequestDemandRow = typeof topicRequestDemands.$inferInsert;
export type AnonymousAnalyticsEventRow = typeof anonymousAnalyticsEvents.$inferSelect;
export type NewAnonymousAnalyticsEventRow = typeof anonymousAnalyticsEvents.$inferInsert;
export type BriefingRow = typeof briefings.$inferSelect;
export type NewBriefingRow = typeof briefings.$inferInsert;
export type BriefingRevisionRow = typeof briefingRevisions.$inferSelect;
export type NewBriefingRevisionRow = typeof briefingRevisions.$inferInsert;
export type SourceSubmissionRow = typeof sourceSubmissions.$inferSelect;
export type NewSourceSubmissionRow = typeof sourceSubmissions.$inferInsert;
export type AcceptedSourceRow = typeof acceptedSources.$inferSelect;
export type NewAcceptedSourceRow = typeof acceptedSources.$inferInsert;
export type ClaimRow = typeof claims.$inferSelect;
export type NewClaimRow = typeof claims.$inferInsert;
export type ClaimSupportRow = typeof claimSupports.$inferSelect;
export type NewClaimSupportRow = typeof claimSupports.$inferInsert;
export type EditorialAuditRecordRow = typeof editorialAuditRecords.$inferSelect;
export type NewEditorialAuditRecordRow = typeof editorialAuditRecords.$inferInsert;
export type ProposalDecisionRecordRow = typeof proposalDecisionRecords.$inferSelect;
export type NewProposalDecisionRecordRow = typeof proposalDecisionRecords.$inferInsert;
