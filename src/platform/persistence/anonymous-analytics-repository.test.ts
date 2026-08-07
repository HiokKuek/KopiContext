import { describe, expect, it, vi } from "vitest";

import {
  anonymousAnalyticsEventInsertValues,
  DrizzleAnonymousAnalyticsRepository,
} from "./anonymous-analytics-repository";
import { anonymousAnalyticsEvents } from "./schema";

const input = {
  idempotencyKey: "event:topic-view:0001",
  event: {
    type: "topic-view" as const,
    sessionId: "kc_session_opaque-session-token",
    occurredAt: "2026-08-07T09:01:00.000Z",
    topicSlug: "cpf",
  },
};

describe("anonymous analytics persistence mapping", () => {
  it("maps a validated event into only the explicit durable allow-list", () => {
    expect(anonymousAnalyticsEventInsertValues(input)).toEqual({
      eventType: "topic-view",
      sessionId: "kc_session_opaque-session-token",
      occurredAt: new Date("2026-08-07T09:01:00.000Z"),
      idempotencyKey: "event:topic-view:0001",
      topicSlug: "cpf",
    });
  });

  it("keeps type-specific fields isolated rather than storing an event JSON blob", () => {
    expect(
      anonymousAnalyticsEventInsertValues({
        event: {
          type: "search-result-click",
          sessionId: "kc_session_opaque-session-token",
          occurredAt: "2026-08-07T09:01:00.000Z",
          query: "cpf",
          topicSlug: "cpf",
          resultPosition: 1,
        },
      }),
    ).toEqual({
      eventType: "search-result-click",
      sessionId: "kc_session_opaque-session-token",
      occurredAt: new Date("2026-08-07T09:01:00.000Z"),
      query: "cpf",
      topicSlug: "cpf",
      resultPosition: 1,
    });
  });

  it("rejects an invalid timestamp before a persistence adapter can write it", () => {
    expect(() =>
      anonymousAnalyticsEventInsertValues({
        event: {
          type: "page-view",
          sessionId: "kc_session_opaque-session-token",
          occurredAt: "not-a-date",
          path: "/",
        },
      }),
    ).toThrow("occurredAt");
  });

  it("uses the opaque delivery key as the only persistence idempotency key", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const repository = new DrizzleAnonymousAnalyticsRepository({ insert } as never);

    await repository.record(input);

    expect(values).toHaveBeenCalledWith(anonymousAnalyticsEventInsertValues(input));
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: anonymousAnalyticsEvents.idempotencyKey,
    });
  });

  it("has no schema column that could retain raw network or browser metadata", () => {
    expect(anonymousAnalyticsEvents).not.toHaveProperty("ip");
    expect(anonymousAnalyticsEvents).not.toHaveProperty("headers");
    expect(anonymousAnalyticsEvents).not.toHaveProperty("userAgent");
    expect(anonymousAnalyticsEvents).not.toHaveProperty("payload");
  });
});
