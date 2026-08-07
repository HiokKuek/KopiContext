import { describe, expect, it, vi } from "vitest";

import type { AgentPreparationProposal, SourcePreparationResult } from "@/modules/preparation/source-preparation";
import type { ClaimedSourceSubmission, SourceSubmissionWorkerQueue } from "@/modules/preparation/source-submission-worker";

import { composeSourcePreparationWorkerRuntime, type SourcePreparationWorkerAdapters } from "./runtime-composition";

const claim: ClaimedSourceSubmission = {
  submissionId: "123e4567-e89b-12d3-a456-426614174000",
  idempotencyKey: "submission:worker-runtime",
  attempt: 1,
  workerId: "source-preparation-a",
  request: {
    idempotencyKey: "submission:worker-runtime",
    submission: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      kind: "transcript",
      originalIdentifier: "https://example.com/transcript",
      submittedBy: "google:editor",
      submittedAt: "2026-08-07T10:00:00.000Z",
      rightsNote: "Rights-cleared for editorial assessment.",
      transcriptText: "Private worker-only transcript.",
    },
  },
};

const proposal: AgentPreparationProposal = {
  classification: { proposedTopic: "Government", confidence: 0.9, rationale: "The material explains a civic institution." },
  candidateClaims: [],
  draft: { templateVersion: "briefing-v1", title: "Government", sections: [{ section: "Overview", body: "A proposed overview." }] },
  risks: [],
  provider: "reviewed-test-provider",
  model: "reviewed-test-model",
  promptVersion: "reviewed-test-prompt-v1",
};

describe("source preparation worker runtime composition", () => {
  it("fails before opening Postgres when reviewed adapters are absent", () => {
    const createPersistence = vi.fn();

    expect(() => composeSourcePreparationWorkerRuntime(config(), { createPersistence })).toThrow(
      "reviewed retrieval and AI adapters",
    );
    expect(createPersistence).not.toHaveBeenCalled();
  });

  it("runs the durable worker only with injected private adapters and persists its proposal", async () => {
    let available = true;
    const queue: SourceSubmissionWorkerQueue = {
      async claimNext() {
        if (!available) return undefined;
        available = false;
        return claim;
      },
      async scheduleRetry() {},
      async escalate() {},
    };
    const saved: SourcePreparationResult[] = [];
    const adapters: SourcePreparationWorkerAdapters = {
      retrieval: {
        retrieve: vi.fn(async (submission) => ({
          canonicalIdentifier: submission.originalIdentifier,
          text: submission.transcriptText ?? "",
          contentFingerprint: "sha256:private-material",
          retrievedFrom: "reviewed-test-retrieval",
        })),
      },
      ai: { prepare: vi.fn(async () => proposal) },
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const runtime = composeSourcePreparationWorkerRuntime(config(), {
      adapters,
      createPersistence: () => ({ db: {} as never, close }),
      createQueue: () => queue,
      createStore: () => ({
        async findByIdempotencyKey() { return undefined; },
        async save(result) { saved.push(result); return result; },
        async findDuplicate() { return undefined; },
      }),
      now: () => "2026-08-07T10:01:00.000Z",
    });

    await expect(runtime.runOnce()).resolves.toMatchObject({ kind: "prepared", claim: { submissionId: claim.submissionId } });
    expect(adapters.retrieval.retrieve).toHaveBeenCalledWith(claim.request.submission);
    expect(adapters.ai.prepare).toHaveBeenCalledOnce();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ state: "prepared", proposal });

    await runtime.close();
    expect(close).toHaveBeenCalledOnce();
  });
});

function config() {
  return {
    database: { connectionString: "postgres://worker:secret@127.0.0.1:5432/kopi_context" },
    workerId: "source-preparation-a",
    adapterModule: "file:///app/src/platform/worker/adapters/reviewed-provider.ts",
    pollIntervalMs: 100,
    leaseMs: 60_000,
    maxAttempts: 3,
  };
}
