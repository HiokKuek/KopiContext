import { describe, expect, it, vi } from "vitest";

import { composePrivateApiRuntime } from "./runtime-composition";
import type { PrivateApiRuntimeConfig } from "./config";

const serviceCredential = "runtime-test-credential";

describe("private API runtime composition", () => {
  it("uses real persistence adapters in production and closes the pool with Fastify", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const createPersistence = vi.fn(() => ({ db: {} as never, close }));
    const runtime = composePrivateApiRuntime(
      productionConfig(),
      { createPersistence },
    );

    expect(createPersistence).toHaveBeenCalledWith(productionConfig().database);

    const health = await runtime.app.inject({
      method: "GET",
      url: "/v1/healthz",
      headers: { authorization: `Bearer ${serviceCredential}` },
    });
    expect(health.statusCode).toBe(200);

    // The public analytics route is composed only in the durable production
    // runtime. A raw-IP payload is rejected before the fake database is used.
    const rejectedAnalytics = await runtime.app.inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      payload: {
        type: "page-view",
        session: { id: "kc_session_opaque-session-token", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:01:00.000Z",
        path: "/",
        ipAddress: "203.0.113.4",
      },
    });
    expect(rejectedAnalytics.statusCode).toBe(400);

    // This fails before persistence is touched, but proves the production
    // composition registers the private Topic-request command route.
    const topicRequest = await runtime.app.inject({
      method: "POST",
      url: "/v1/discovery/topic-requests",
      headers: { authorization: `Bearer ${serviceCredential}` },
      payload: {},
    });
    expect(topicRequest.statusCode).toBe(400);

    // Production also composes durable source intake. Invalid transport input
    // proves the route exists without trying to use the fake database.
    const sourceSubmission = await runtime.app.inject({
      method: "POST",
      url: "/v1/source-submissions",
      headers: { authorization: `Bearer ${serviceCredential}` },
      payload: {},
    });
    expect(sourceSubmission.statusCode).toBe(400);

    // Prepared-proposal acceptance is production-only. This malformed command
    // proves the authenticated route is composed without invoking fake storage.
    const proposalAcceptance = await runtime.app.inject({
      method: "POST",
      url: "/v1/editorial/source-submissions/123e4567-e89b-12d3-a456-426614174000/acceptance",
      headers: { authorization: `Bearer ${serviceCredential}` },
      payload: {},
    });
    expect(proposalAcceptance.statusCode).toBe(400);

    // The query exists in production composition, and the shared credential
    // gate is applied before any substitute persistence object is touched.
    const editorQueue = await runtime.app.inject({
      method: "GET",
      url: "/v1/editorial/work",
      headers: { authorization: `Bearer ${serviceCredential}` },
    });
    expect(editorQueue.statusCode).toBe(500);

    await runtime.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses reader fixtures only in explicitly selected local development mode", async () => {
    const createPersistence = vi.fn();
    const runtime = composePrivateApiRuntime(
      {
        mode: "local-development",
        host: "127.0.0.1",
        port: 3001,
        serviceCredential,
      },
      { createPersistence },
    );

    const response = await runtime.app.inject({
      method: "GET",
      url: "/v1/public/briefings/how-singapores-government-works",
    });

    expect(response.statusCode).toBe(200);
    expect(createPersistence).not.toHaveBeenCalled();
    await runtime.close();
  });
});

function productionConfig(): Extract<PrivateApiRuntimeConfig, { mode: "production" }> {
  return {
    mode: "production",
    host: "127.0.0.1",
    port: 3001,
    serviceCredential,
    database: { connectionString: "postgres://api:secret@127.0.0.1:5432/kopi_context" },
  };
}
