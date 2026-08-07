import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceSubmissionCommand } from "./source-submission-route";
import { registerSourceSubmissionRoute } from "./source-submission-route";

describe("source-submission API route", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(sourceSubmissions: SourceSubmissionCommand) {
    const app = Fastify({ logger: false });
    registerSourceSubmissionRoute(app, sourceSubmissions);
    apps.push(app);
    return app;
  }

  it("passes a validated submission to the injected intake command and returns only a safe queue acknowledgement", async () => {
    const queue = vi.fn().mockResolvedValue({
      state: "queued",
      idempotencyKey: "submission:government-video:v1",
      submissionId: validBody.submission.id,
      queuedAt: "2026-08-07T10:00:00.000Z",
    });
    const response = await createApp({ queue }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: validBody,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      submission: {
        state: "queued",
        idempotencyKey: "submission:government-video:v1",
        submissionId: validBody.submission.id,
        queuedAt: "2026-08-07T10:00:00.000Z",
      },
    });
    expect(queue).toHaveBeenCalledWith(validBody);
  });

  it("rejects malformed or incomplete request bodies without invoking intake", async () => {
    const queue = vi.fn();
    const response = await createApp({ queue }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: {
        ...validBody,
        submission: { ...validBody.submission, kind: "podcast" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "The source-submission request is invalid.",
      },
    });
    expect(queue).not.toHaveBeenCalled();
  });

  it("rejects unrecognised fields so callers cannot silently lose provenance", async () => {
    const queue = vi.fn();
    const response = await createApp({ queue }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: { ...validBody, accidentalField: "not recorded" },
    });

    expect(response.statusCode).toBe(400);
    expect(queue).not.toHaveBeenCalled();
  });
});

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
} as const;
