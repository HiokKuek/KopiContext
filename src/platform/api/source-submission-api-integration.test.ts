import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { SourceSubmissionCommand } from "./source-submission-route";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test-credential" ? { kind: "private-service" } : null;
  },
};

const publicCatalogue: PublicCatalogueQuery = {
  findPublishedBriefingBySlug: () => undefined,
};

const validBody = {
  idempotencyKey: "submission:government-video:v1",
  submission: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    kind: "transcript",
    originalIdentifier: "https://example.com/video-transcript",
    submittedBy: "editor-ernest",
    submittedAt: "2026-08-07T09:30:00.000Z",
    rightsNote: "Submitted for editorial assessment.",
  },
};

describe("source-submission private API composition", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(sourceSubmissions: SourceSubmissionCommand) {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      sourceSubmissions,
    });
    apps.push(app);
    return app;
  }

  it("requires a private service credential before accepting a source submission", async () => {
    const queue = vi.fn();
    const response = await createApp({ queue }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: validBody,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "unauthorized", message: "A valid service credential is required." },
    });
    expect(queue).not.toHaveBeenCalled();
  });

  it("exposes the composed command only to an authenticated private service", async () => {
    const queue = vi.fn().mockResolvedValue({
      state: "queued",
      idempotencyKey: validBody.idempotencyKey,
      submissionId: validBody.submission.id,
      queuedAt: "2026-08-07T10:00:00.000Z",
    });
    const response = await createApp({ queue }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      headers: { authorization: "Bearer test-credential" },
      payload: validBody,
    });

    expect(response.statusCode).toBe(202);
    expect(queue).toHaveBeenCalledWith(validBody);
  });
});
