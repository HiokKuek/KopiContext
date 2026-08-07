import { describe, expect, it } from "vitest";

import {
  createInMemoryPreparationStore,
  createLocalDevelopmentPreparationAi,
  createLocalSourcePreparationCommand,
  createLocalTranscriptRetrieval,
} from "./local-development-adapters";
import { prepareSourceSubmission } from "./source-preparation";

const transcriptText = "Parliament debates Bills before they can become law.";

const firstSubmission = {
  id: "submission-government-transcript",
  kind: "transcript" as const,
  originalIdentifier: "local://transcripts/government-explainer",
  submittedBy: "editor-ernest",
  submittedAt: "2026-08-07T09:30:00.000Z",
  rightsNote: "Transcript supplied by the editor for assessment.",
};

describe("local source-preparation adapters", () => {
  it("prepares an explicitly registered transcript with a deterministic, non-production placeholder", async () => {
    const command = createLocalSourcePreparationCommand({
      transcripts: [{ identifier: firstSubmission.originalIdentifier, text: transcriptText }],
      clock: { now: () => "2026-08-07T10:00:00.000Z" },
    });

    const result = await command.prepare({
      idempotencyKey: "local:government-transcript:v1",
      submission: firstSubmission,
    });

    expect(result).toMatchObject({
      state: "needs-review",
      provenance: {
        retrieval: {
          canonicalIdentifier: firstSubmission.originalIdentifier,
          retrievedFrom: "local-transcript-registry",
          contentFingerprint: "sha256:69ddf6309930a625c3c12bfb4eafe8f8a0e3f33290d501ce617f461883717294",
        },
        ai: {
          provider: "local-development-placeholder",
          model: "no-external-ai",
          promptVersion: "local-placeholder-v1",
        },
      },
      proposal: {
        classification: { proposedTopic: "Unassigned Topic", confidence: 0 },
        candidateClaims: [],
        risks: ["Local development placeholder: no external AI was called; editorial review is required."],
      },
    });
    expect(result.history.map((entry) => entry.stage)).toEqual(["retrieved", "escalated"]);
  });

  it("keeps idempotent results and detects matching registered transcript material", async () => {
    const retrieval = createLocalTranscriptRetrieval([
      { identifier: firstSubmission.originalIdentifier, text: transcriptText },
      { identifier: "local://transcripts/government-copy", text: transcriptText },
    ]);
    const store = createInMemoryPreparationStore();
    const dependencies = {
      retrieval,
      duplicates: store,
      ai: createLocalDevelopmentPreparationAi(),
      store,
      clock: { now: () => "2026-08-07T10:00:00.000Z" },
    };

    const first = await prepareSourceSubmission(
      { idempotencyKey: "local:one", submission: firstSubmission },
      dependencies,
    );
    const retried = await prepareSourceSubmission(
      { idempotencyKey: "local:one", submission: firstSubmission },
      dependencies,
    );
    const duplicate = await prepareSourceSubmission(
      {
        idempotencyKey: "local:two",
        submission: { ...firstSubmission, id: "submission-government-copy", originalIdentifier: "local://transcripts/government-copy" },
      },
      dependencies,
    );

    expect(retried).toEqual(first);
    expect(duplicate).toMatchObject({
      state: "duplicate",
      duplicateOfSubmissionId: firstSubmission.id,
    });
  });

  it("does not retrieve URLs or documents from the network in local development", async () => {
    const command = createLocalSourcePreparationCommand({
      transcripts: [{ identifier: firstSubmission.originalIdentifier, text: transcriptText }],
      clock: { now: () => "2026-08-07T10:00:00.000Z" },
    });

    const result = await command.prepare({
      idempotencyKey: "local:url:v1",
      submission: { ...firstSubmission, id: "submission-url", kind: "url" },
    });

    expect(result).toMatchObject({ state: "failed", failure: "retrieval-failed" });
  });
});
