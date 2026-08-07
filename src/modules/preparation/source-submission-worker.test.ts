import { describe, expect, it, vi } from "vitest";

import { createSourceSubmissionWorker, type ClaimedSourceSubmission, type SourceSubmissionWorkerQueue } from "./source-submission-worker";

const claim: ClaimedSourceSubmission = {
  submissionId: "123e4567-e89b-12d3-a456-426614174000", idempotencyKey: "submission:one",
  request: { idempotencyKey: "submission:one", submission: { id: "123e4567-e89b-12d3-a456-426614174000", kind: "transcript", originalIdentifier: "one", submittedBy: "google:1", submittedAt: "2026-08-07T10:00:00.000Z", rightsNote: "rights" } },
  attempt: 1, workerId: "worker-a",
};

describe("Source Submission worker", () => {
  it("allows only one concurrent worker to claim one queued submission", async () => {
    let available = true;
    const queue: SourceSubmissionWorkerQueue = {
      async claimNext() { if (!available) return undefined; available = false; return claim; },
      async scheduleRetry() {}, async escalate() {},
    };
    const prepare = vi.fn().mockResolvedValue({ state: "failed", idempotencyKey: claim.idempotencyKey, submission: claim.request.submission, history: [], failure: "preparation-failed" });
    const first = createSourceSubmissionWorker(queue, { prepare }, { workerId: "worker-a" });
    const second = createSourceSubmissionWorker(queue, { prepare }, { workerId: "worker-b" });

    const results = await Promise.all([first.runOnce(), second.runOnce()]);
    expect(results.map((result) => result.kind).sort()).toEqual(["idle", "prepared"]);
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("schedules one bounded retry for an unexpected provider/job failure", async () => {
    const scheduleRetry = vi.fn();
    const queue: SourceSubmissionWorkerQueue = {
      async claimNext() { return { ...claim, attempt: 1 }; },
      scheduleRetry,
      async escalate() {},
    };
    const worker = createSourceSubmissionWorker(
      queue,
      { prepare: async () => { throw new Error("retrieval timeout"); } },
      { workerId: "worker-a", now: () => new Date("2026-08-07T10:00:00.000Z"), retryDelayMs: () => 5_000 },
    );
    await expect(worker.runOnce()).resolves.toMatchObject({ kind: "retry-scheduled" });
    expect(scheduleRetry).toHaveBeenCalledWith(expect.objectContaining({
      claim: expect.objectContaining({ submissionId: claim.submissionId }),
      retryAt: "2026-08-07T10:00:05.000Z",
      error: "retrieval timeout",
    }));
  });

  it("escalates instead of retrying past the attempt bound", async () => {
    const escalate = vi.fn();
    const queue: SourceSubmissionWorkerQueue = { async claimNext() { return { ...claim, attempt: 3 }; }, async scheduleRetry() {}, escalate };
    const worker = createSourceSubmissionWorker(queue, { prepare: async () => { throw new Error("provider unavailable"); } }, { workerId: "worker-a", maxAttempts: 3 });
    await expect(worker.runOnce()).resolves.toMatchObject({ kind: "escalated" });
    expect(escalate).toHaveBeenCalledOnce();
  });
});
