import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnonymousAnalyticsEventCommand } from "./analytics-event-route";
import { registerAnonymousAnalyticsEventRoute } from "./analytics-event-route";

describe("anonymous analytics event API route", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(analyticsEvents: AnonymousAnalyticsEventCommand) {
    const app = Fastify({ logger: false });
    registerAnonymousAnalyticsEventRoute(app, analyticsEvents);
    apps.push(app);
    return app;
  }

  it("passes only the validated allow-listed event to the injected delivery command", async () => {
    const record = vi.fn();
    const response = await createApp({ record }).inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      headers: { "idempotency-key": "event:topic-view:0001" },
      payload: {
        type: "topic-view",
        session: { id: "kc_session_opaque-session-token", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "  cpf  ",
        ignoredBrowserMetadata: "not persisted",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true });
    expect(record).toHaveBeenCalledWith({
      idempotencyKey: "event:topic-view:0001",
      event: {
        type: "topic-view",
        sessionId: "kc_session_opaque-session-token",
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
      },
    });
  });

  it("does not invoke the delivery command for raw IP data or malformed events", async () => {
    const record = vi.fn();
    const app = createApp({ record });
    const rawIp = await app.inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      payload: {
        type: "page-view",
        session: { id: "kc_session_opaque-session-token", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:01:00.000Z",
        path: "/topics/cpf",
        ipAddress: "203.0.113.4",
      },
    });
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      payload: { type: "topic-view" },
    });

    expect(rawIp.statusCode).toBe(400);
    expect(malformed.statusCode).toBe(400);
    expect(rawIp.json()).toEqual({
      error: { code: "invalid_request", message: "The analytics event request is invalid." },
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects an invalid idempotency key before delivery", async () => {
    const record = vi.fn();
    const response = await createApp({ record }).inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      headers: { "idempotency-key": "user@example.com" },
      payload: validTopicView,
    });

    expect(response.statusCode).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
});

const validTopicView = {
  type: "topic-view",
  session: { id: "kc_session_opaque-session-token", issuedAt: "2026-08-07T09:00:00.000Z" },
  occurredAt: "2026-08-07T09:01:00.000Z",
  topicSlug: "cpf",
} as const;
