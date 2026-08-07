import { describe, expect, it, vi } from "vitest";

import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
} from "@/modules/auth/editor-auth";

import { createEditorSourceSubmissionRouteHandler } from "./editor-source-submission-route-handler";

const submissionId = "123e4567-e89b-12d3-a456-426614174000";
const queuedAt = "2026-08-07T10:00:00.000Z";

describe("editor Source Submission BFF route", () => {
  it("derives provenance from the trusted editor and queues only browser-safe material fields", async () => {
    const queue = vi.fn().mockResolvedValue({
      state: "queued",
      idempotencyKey: `source-submission:${submissionId}`,
      submissionId,
      queuedAt,
    });
    const handler = createEditorSourceSubmissionRouteHandler({
      requireEditor: async () => ({ actorId: "google:113355779900", email: "ernest.tanhk@gmail.com" }),
      sourceSubmissions: { queue },
      now: () => new Date(queuedAt),
      newId: () => submissionId,
    });

    const response = await handler(jsonRequest({
      kind: "transcript",
      originalIdentifier: "editor-upload:government-video",
      rightsNote: "Editor-provided transcript for assessment.",
    }));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      submission: {
        state: "queued",
        idempotencyKey: `source-submission:${submissionId}`,
        submissionId,
        queuedAt,
      },
    });
    expect(queue).toHaveBeenCalledWith({
      idempotencyKey: `source-submission:${submissionId}`,
      submission: {
        id: submissionId,
        kind: "transcript",
        originalIdentifier: "editor-upload:government-video",
        submittedBy: "google:113355779900",
        submittedAt: queuedAt,
        rightsNote: "Editor-provided transcript for assessment.",
      },
    });
    expect(JSON.stringify(queue.mock.calls)).not.toContain("ernest.tanhk@gmail.com");
  });

  it("accepts bounded transcript text only for a transcript and forwards it only to the private queue", async () => {
    const queue=vi.fn().mockResolvedValue({state:"queued",idempotencyKey:`source-submission:${submissionId}`,submissionId,queuedAt});
    const handler=createEditorSourceSubmissionRouteHandler({requireEditor:async()=>({actorId:"google:113355779900",email:"ernest.tanhk@gmail.com"}),sourceSubmissions:{queue},newId:()=>submissionId});
    expect((await handler(jsonRequest({kind:"transcript",originalIdentifier:"video",rightsNote:"Editor supplied",transcriptText:"Private transcript text."}))).status).toBe(202);
    expect(queue.mock.calls[0]?.[0].submission.transcriptText).toBe("Private transcript text.");
    expect((await handler(jsonRequest({kind:"url",originalIdentifier:"https://example.test",rightsNote:"Public",transcriptText:"not allowed"}))).status).toBe(400);
  });

  it("rejects malformed browser input before evaluating the editor session", async () => {
    const requireEditor = vi.fn();
    const queue = vi.fn();
    const handler = createEditorSourceSubmissionRouteHandler({ requireEditor, sourceSubmissions: { queue } });

    const response = await handler(jsonRequest({ kind: "podcast" }));

    expect(response.status).toBe(400);
    expect(requireEditor).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
  });

  it("fails closed for missing or disallowed editor sessions", async () => {
    const queue = vi.fn();
    const missingSession = createEditorSourceSubmissionRouteHandler({
      requireEditor: async () => { throw new EditorAuthenticationRequiredError("No session"); },
      sourceSubmissions: { queue },
    });
    const deniedSession = createEditorSourceSubmissionRouteHandler({
      requireEditor: async () => { throw new EditorAccessDeniedError("Denied"); },
      sourceSubmissions: { queue },
    });

    expect((await missingSession(validRequest())).status).toBe(401);
    expect((await deniedSession(validRequest())).status).toBe(403);
    expect(queue).not.toHaveBeenCalled();
  });

  it("does not disclose private API details when queueing fails", async () => {
    const handler = createEditorSourceSubmissionRouteHandler({
      requireEditor: async () => ({ actorId: "google:113355779900", email: "ernest.tanhk@gmail.com" }),
      sourceSubmissions: { queue: async () => { throw new Error("private host is down"); } },
      newId: () => submissionId,
    });

    const response = await handler(validRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "source_submission_unavailable", message: "Material could not be queued. Try again shortly." },
    });
  });
});

function validRequest(): Request {
  return jsonRequest({
    kind: "url",
    originalIdentifier: "https://www.gov.sg/",
    rightsNote: "Official public reference for assessment.",
  });
}

function jsonRequest(body: unknown): Request {
  return new Request("https://kopi.example.test/api/editor/source-submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
