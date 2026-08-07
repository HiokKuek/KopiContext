import { describe, expect, it, vi } from "vitest";

import { createSourceSubmissionBff } from "./source-submission-bff";

describe("Source Submission private BFF", () => {
  it("sends the request through the server-only private command and accepts only a safe queue outcome", async () => {
    const command = vi.fn().mockResolvedValue({
      submission: {
        state: "queued",
        idempotencyKey: "source-submission:123e4567-e89b-12d3-a456-426614174000",
        submissionId: "123e4567-e89b-12d3-a456-426614174000",
        queuedAt: "2026-08-07T10:00:00.000Z",
      },
    });
    const transport = createSourceSubmissionBff({ command });
    const request = {
      idempotencyKey: "source-submission:123e4567-e89b-12d3-a456-426614174000",
      submission: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        kind: "url" as const,
        originalIdentifier: "https://www.gov.sg/",
        submittedBy: "google:113355779900",
        submittedAt: "2026-08-07T10:00:00.000Z",
        rightsNote: "Official reference.",
      },
    };

    await expect(transport.queue(request)).resolves.toEqual({
      state: "queued",
      idempotencyKey: request.idempotencyKey,
      submissionId: request.submission.id,
      queuedAt: "2026-08-07T10:00:00.000Z",
    });
    expect(command).toHaveBeenCalledWith({
      path: "/v1/source-submissions",
      method: "POST",
      body: request,
    });
  });
});
