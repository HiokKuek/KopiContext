import { and, asc, gte, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { ValidatedAnonymousEvent } from "@/modules/analytics/anonymous-events";

import { anonymousAnalyticsEvents, type NewAnonymousAnalyticsEventRow } from "./schema";

export type DurableAnonymousAnalyticsEvent = Readonly<{
  event: ValidatedAnonymousEvent;
  idempotencyKey?: string;
}>;

/**
 * A deliberately small aggregate read model. It supports operational checks
 * and future discovery prioritisation without exposing an event log to a UI.
 */
export type DailyAnonymousAnalyticsAggregate = Readonly<{
  day: string;
  eventType: ValidatedAnonymousEvent["type"];
  topicSlug?: string;
  eventCount: number;
}>;

/**
 * Database adapter for the already-validated analytics command. Its direct,
 * allow-listed columns make it impossible for a request IP, header, device
 * value, cookie, or arbitrary payload property to enter the event log.
 */
export class DrizzleAnonymousAnalyticsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async record(input: DurableAnonymousAnalyticsEvent): Promise<void> {
    await this.db
      .insert(anonymousAnalyticsEvents)
      .values(anonymousAnalyticsEventInsertValues(input))
      .onConflictDoNothing({ target: anonymousAnalyticsEvents.idempotencyKey });
  }

  async listDailyAggregates(input: Readonly<{ from: string; to: string }>): Promise<ReadonlyArray<DailyAnonymousAnalyticsAggregate>> {
    const from = requiredDate(input.from, "from");
    const to = requiredDate(input.to, "to");
    if (from >= to) {
      throw new Error("Analytics aggregate range must have a before to.");
    }

    const day = sql<string>`date_trunc('day', ${anonymousAnalyticsEvents.occurredAt})::date`.as("day");
    const eventCount = sql<number>`count(*)::integer`.as("event_count");
    const rows = await this.db
      .select({
        day,
        eventType: anonymousAnalyticsEvents.eventType,
        topicSlug: anonymousAnalyticsEvents.topicSlug,
        eventCount,
      })
      .from(anonymousAnalyticsEvents)
      .where(
        and(
          gte(anonymousAnalyticsEvents.occurredAt, from),
          lt(anonymousAnalyticsEvents.occurredAt, to),
        ),
      )
      .groupBy(day, anonymousAnalyticsEvents.eventType, anonymousAnalyticsEvents.topicSlug)
      .orderBy(asc(day), asc(anonymousAnalyticsEvents.eventType));

    return rows.map((row) => ({
      day: row.day,
      eventType: row.eventType,
      ...(row.topicSlug ? { topicSlug: row.topicSlug } : {}),
      eventCount: row.eventCount,
    }));
  }
}

/** Maps a discriminated analytics event into exactly the database allow-list. */
export function anonymousAnalyticsEventInsertValues(
  input: DurableAnonymousAnalyticsEvent,
): NewAnonymousAnalyticsEventRow {
  const base = {
    eventType: input.event.type,
    sessionId: input.event.sessionId,
    occurredAt: requiredDate(input.event.occurredAt, "occurredAt"),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  } as const;

  switch (input.event.type) {
    case "page-view":
      return { ...base, path: input.event.path };
    case "search":
    case "no-result-search":
      return { ...base, query: input.event.query };
    case "search-result-click":
      return {
        ...base,
        query: input.event.query,
        topicSlug: input.event.topicSlug,
        resultPosition: input.event.resultPosition,
      };
    case "topic-view":
      return { ...base, topicSlug: input.event.topicSlug };
    case "section-expanded":
      return { ...base, topicSlug: input.event.topicSlug, sectionId: input.event.sectionId };
    case "current-update-opened":
      return { ...base, topicSlug: input.event.topicSlug, updateId: input.event.updateId };
    case "related-topic-click":
      return {
        ...base,
        topicSlug: input.event.topicSlug,
        relatedTopicSlug: input.event.relatedTopicSlug,
      };
    case "share":
      return { ...base, topicSlug: input.event.topicSlug, shareMethod: input.event.method };
    case "topic-request":
      return { ...base, requestedTopic: input.event.requestedTopic };
    case "feedback":
      return {
        ...base,
        topicSlug: input.event.topicSlug,
        feedbackSentiment: input.event.sentiment,
      };
  }
}

function requiredDate(value: string, name: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Analytics ${name} must be a valid ISO timestamp.`);
  }
  return date;
}
