import { describe, expect, it, vi } from "vitest";

import { createSourceSubmissionIntakeCommand } from "./source-submission-intake";

const request = {
  idempotencyKey: "source-submission:government-video:v1",
  submission: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    kind: "transcript" as const,
    originalIdentifier: "editor-upload:government-video",
    submittedBy: "ernest.tanhk@gmail.com",
    submittedAt: "2026-08-07T09:00:00.000Z",
    rightsNote: "Editor-provided transcript for assessment.",
  },
};

describe("Source Submission intake", () => {
  it("durably queues supplied material without retrieving, preparing, accepting, or publishing it", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      state: "queued",
      idempotencyKey: request.idempotencyKey,
      submissionId: request.submission.id,
      queuedAt: "2026-08-07T10:00:00.000Z",
    });
    const command = createSourceSubmissionIntakeCommand(
      { enqueue },
      { now: () => new Date("2026-08-07T10:00:00.000Z") },
    );

    await expect(command.queue(request)).resolves.toEqual({
      state: "queued",
      idempotencyKey: request.idempotencyKey,
      submissionId: request.submission.id,
      queuedAt: "2026-08-07T10:00:00.000Z",
    });
    expect(enqueue).toHaveBeenCalledWith(request, "2026-08-07T10:00:00.000Z");
  });
});
