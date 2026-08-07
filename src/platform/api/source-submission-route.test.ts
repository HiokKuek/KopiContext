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

  it("passes a validated submission to the injected application command", async () => {
    const prepare = vi.fn().mockResolvedValue({
      state: "prepared",
      idempotencyKey: "submission:government-video:v1",
      provenance: { submission: validBody.submission },
      history: [],
      proposal: { title: "A draft" },
    });
    const response = await createApp({ prepare }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: validBody,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      preparation: {
        state: "prepared",
        idempotencyKey: "submission:government-video:v1",
        provenance: { submission: validBody.submission },
        history: [],
        proposal: { title: "A draft" },
      },
    });
    expect(prepare).toHaveBeenCalledWith(validBody);
  });

  it("rejects malformed or incomplete request bodies without invoking preparation", async () => {
    const prepare = vi.fn();
    const response = await createApp({ prepare }).inject({
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
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects unrecognised fields so callers cannot silently lose provenance", async () => {
    const prepare = vi.fn();
    const response = await createApp({ prepare }).inject({
      method: "POST",
      url: "/v1/source-submissions",
      payload: { ...validBody, accidentalField: "not recorded" },
    });

    expect(response.statusCode).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
});

const validBody = {
  idempotencyKey: "submission:government-video:v1",
  submission: {
    id: "submission-government-video",
    kind: "transcript",
    originalIdentifier: "https://example.com/video-transcript",
    submittedBy: "editor-ernest",
    submittedAt: "2026-08-07T09:30:00.000Z",
    rightsNote: "Submitted for editorial assessment.",
  },
} as const;
