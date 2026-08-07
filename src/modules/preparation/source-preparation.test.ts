import { describe, expect, it } from "vitest";

import {
  prepareSourceSubmission,
  type AgentPreparationProposal,
  type PrepareSourceSubmissionDependencies,
  type SourcePreparationResult,
  type SourcePreparationStore,
} from "./source-preparation";

const submission = {
  id: "submission-government-video",
  kind: "transcript" as const,
  originalIdentifier: "https://youtube.example/government-explainer",
  submittedBy: "editor-1",
  submittedAt: "2026-08-07T09:00:00.000Z",
  rightsNote: "Transcript supplied by the editor for assessment.",
};

const proposal: AgentPreparationProposal = {
  classification: {
    proposedTopic: "How Singapore's Government Works",
    proposedSubtopic: "Parliament",
    confidence: 0.93,
    rationale: "The submitted material explains Parliament's role.",
  },
  candidateClaims: [
    {
      statement: "Parliament debates and passes laws.",
      excerpt: "Parliament debates and passes laws.",
      supportingSubmissionId: submission.id,
      confidence: 0.91,
      rationale: "The statement appears directly in the transcript.",
    },
  ],
  draft: {
    templateVersion: "briefing-v1",
    title: "How Singapore's Government Works",
    sections: [{ section: "The short answer", body: "Parliament makes laws." }],
  },
  risks: [],
  provider: "test-ai",
  model: "test-model",
  promptVersion: "source-preparation-v1",
};

function createStore(): SourcePreparationStore & { saved: SourcePreparationResult[] } {
  const outcomes = new Map<string, SourcePreparationResult>();
  const saved: SourcePreparationResult[] = [];
  return {
    saved,
    async findByIdempotencyKey(key) {
      return outcomes.get(key);
    },
    async save(result) {
      outcomes.set(result.idempotencyKey, result);
      saved.push(result);
    },
  };
}

function createDependencies(
  overrides: Partial<PrepareSourceSubmissionDependencies> = {},
): PrepareSourceSubmissionDependencies & { store: ReturnType<typeof createStore> } {
  const store = createStore();
  const { store: _ignoredStore, ...adapterOverrides } = overrides;
  return {
    store,
    clock: { now: () => "2026-08-07T10:00:00.000Z" },
    retrieval: {
      async retrieve() {
        return {
          canonicalIdentifier: "https://youtube.example/government-explainer",
          retrievedFrom: "editor-provided-transcript",
          contentFingerprint: "sha256:abc123",
          text: "Parliament debates and passes laws.",
        };
      },
    },
    duplicates: { async findDuplicate() { return undefined; } },
    ai: { async prepare() { return proposal; } },
    ...adapterOverrides,
  };
}

describe("prepareSourceSubmission", () => {
  it("keeps provenance and returns only reviewable classification, claim, and draft proposals", async () => {
    const dependencies = createDependencies();

    const result = await prepareSourceSubmission(
      { idempotencyKey: "source-submission:government-video:v1", submission },
      dependencies,
    );

    expect(result).toMatchObject({
      state: "prepared",
      provenance: {
        submission,
        retrieval: {
          canonicalIdentifier: submission.originalIdentifier,
          retrievedFrom: "editor-provided-transcript",
          retrievedAt: "2026-08-07T10:00:00.000Z",
          contentFingerprint: "sha256:abc123",
        },
        ai: { provider: "test-ai", model: "test-model", promptVersion: "source-preparation-v1" },
      },
      proposal: {
        classification: { proposedTopic: "How Singapore's Government Works" },
        candidateClaims: [{ supportingSubmissionId: submission.id }],
      },
    });
    expect(result.history.map((entry) => entry.stage)).toEqual(["retrieved", "prepared"]);
    expect(JSON.stringify(result)).not.toContain("acceptedSource");
    expect(JSON.stringify(result)).not.toContain('"published"');
  });

  it("is idempotent and does not retrieve or prepare a second time", async () => {
    let retrievalCalls = 0;
    let aiCalls = 0;
    const dependencies = createDependencies({
      retrieval: {
        async retrieve() {
          retrievalCalls += 1;
          return {
            canonicalIdentifier: submission.originalIdentifier,
            retrievedFrom: "editor-provided-transcript",
            contentFingerprint: "sha256:abc123",
            text: "text",
          };
        },
      },
      ai: { async prepare() { aiCalls += 1; return proposal; } },
    });
    const request = { idempotencyKey: "same-key", submission };

    const first = await prepareSourceSubmission(request, dependencies);
    const second = await prepareSourceSubmission(request, dependencies);

    expect(second).toEqual(first);
    expect(retrievalCalls).toBe(1);
    expect(aiCalls).toBe(1);
    expect(dependencies.store.saved).toHaveLength(1);
  });

  it("deduplicates before calling AI and retains the submitted material's provenance", async () => {
    let aiCalls = 0;
    const dependencies = createDependencies({
      duplicates: { async findDuplicate() { return { submissionId: "submission-existing" }; } },
      ai: { async prepare() { aiCalls += 1; return proposal; } },
    });

    const result = await prepareSourceSubmission({ idempotencyKey: "duplicate-key", submission }, dependencies);

    expect(result).toMatchObject({
      state: "duplicate",
      duplicateOfSubmissionId: "submission-existing",
      provenance: { submission, retrieval: { contentFingerprint: "sha256:abc123" } },
    });
    expect(aiCalls).toBe(0);
  });

  it("escalates low-confidence or risky work for editorial review", async () => {
    const dependencies = createDependencies({
      ai: {
        async prepare() {
          return { ...proposal, risks: ["Civic material needs primary-source verification."], classification: { ...proposal.classification, confidence: 0.65 } };
        },
      },
    });

    const result = await prepareSourceSubmission({ idempotencyKey: "review-key", submission }, dependencies);

    expect(result).toMatchObject({ state: "needs-review" });
    expect(result.history.at(-1)).toMatchObject({ stage: "escalated" });
  });

  it("returns a bounded failure outcome when a provider fails", async () => {
    const dependencies = createDependencies({
      ai: { async prepare() { throw new Error("provider outage"); } },
    });

    await expect(prepareSourceSubmission({ idempotencyKey: "failure-key", submission }, dependencies)).resolves.toMatchObject({
      state: "failed",
      failure: "preparation-failed",
      submission,
    });
  });
});
