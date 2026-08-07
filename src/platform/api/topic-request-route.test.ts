import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { TopicRequestCommand } from "./topic-request-route";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer bff-credential" ? { kind: "private-service" } : null;
  },
};

const publicCatalogue: PublicCatalogueQuery = { findPublishedBriefingBySlug: () => undefined };

describe("Topic-request private API route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(topicRequests: TopicRequestCommand) {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      topicRequests,
    });
    apps.push(app);
    return app;
  }

  it("requires the private BFF service credential before accepting demand", async () => {
    const submit = vi.fn();
    const response = await createApp({ submit }).inject({
      method: "POST",
      url: "/v1/discovery/topic-requests",
      payload: { requestedTopic: "How does CPF work?" },
    });

    expect(response.statusCode).toBe(401);
    expect(submit).not.toHaveBeenCalled();
  });

  it("passes only one normalised Topic field to the injected aggregate command", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "received" });
    const response = await createApp({ submit }).inject({
      method: "POST",
      url: "/v1/discovery/topic-requests",
      headers: { authorization: "Bearer bff-credential" },
      payload: { requestedTopic: "  How does   CPF work?  " },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: "received" });
    expect(submit).toHaveBeenCalledWith({ requestedTopic: "How does CPF work?" });
  });

  it("rejects personal and extra data before the command can receive it", async () => {
    const submit = vi.fn();
    const app = createApp({ submit });
    const personal = await app.inject({
      method: "POST",
      url: "/v1/discovery/topic-requests",
      headers: { authorization: "Bearer bff-credential" },
      payload: { requestedTopic: "reader@example.com" },
    });
    const metadata = await app.inject({
      method: "POST",
      url: "/v1/discovery/topic-requests",
      headers: { authorization: "Bearer bff-credential" },
      payload: { requestedTopic: "CPF", rawIp: "203.0.113.7" },
    });

    expect(personal.statusCode).toBe(400);
    expect(metadata.statusCode).toBe(400);
    expect(personal.json()).toEqual({
      error: { code: "invalid_request", message: "The Topic request is invalid." },
    });
    expect(submit).not.toHaveBeenCalled();
  });
});
