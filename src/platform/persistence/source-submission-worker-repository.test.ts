import { describe, expect, it } from "vitest";

import { toClaimedSourceSubmission } from "./source-submission-worker-repository";

const base = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  idempotencyKey: "source-submission:one",
  originalIdentifier: "editor-upload:government-video",
  submittedBy: "google:editor",
  submittedAt: new Date("2026-08-07T10:00:00.000Z"),
  rightsNote: "Editor-supplied transcript for assessment.",
};

describe("DrizzleSourceSubmissionWorkerQueue claim projection", () => {
  it("makes a supplied transcript available only to the private worker claim", () => {
    const claim = toClaimedSourceSubmission({
      ...base,
      kind: "transcript",
      submittedTranscriptText: "A private transcript excerpt.",
    }, 1, "worker-a");

    expect(claim.request.submission).toMatchObject({
      kind: "transcript",
      transcriptText: "A private transcript excerpt.",
    });
  });

  it("does not add transcript text to URL or document claims", () => {
    const claim = toClaimedSourceSubmission({
      ...base,
      kind: "url",
      submittedTranscriptText: null,
    }, 1, "worker-a");

    expect(claim.request.submission).not.toHaveProperty("transcriptText");
  });
});
