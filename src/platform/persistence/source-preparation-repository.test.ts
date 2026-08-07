import { describe, expect, it } from "vitest";

import type { SourcePreparationResult } from "@/modules/preparation/source-preparation";

import {
  mapPersistedSourcePreparation,
  sourcePreparationPersistenceValues,
} from "./source-preparation-repository";
import type { SourceSubmissionRow } from "./schema";

const submission = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  kind: "transcript" as const,
  originalIdentifier: "editor-upload:government-video",
  submittedBy: "ernest.tanhk@gmail.com",
  submittedAt: "2026-08-07T09:00:00.000Z",
  rightsNote: "Editor-provided transcript for assessment.",
};

const prepared: SourcePreparationResult = {
  state: "prepared",
  idempotencyKey: "source-submission:government-video:v1",
  provenance: {
    submission,
    retrieval: {
      canonicalIdentifier: "youtube:government-video",
      retrievedFrom: "editor-provided-transcript",
      retrievedAt: "2026-08-07T10:00:00.000Z",
      contentFingerprint: "sha256:abc123",
    },
    ai: {
      provider: "reviewed-provider",
      model: "reviewed-model",
      promptVersion: "preparation-v1",
      inputFingerprint: "sha256:abc123",
    },
  },
  history: [
    { stage: "retrieved", occurredAt: "2026-08-07T10:00:00.000Z", detail: "Retained." },
    { stage: "prepared", occurredAt: "2026-08-07T10:01:00.000Z", detail: "Ready for review." },
  ],
  proposal: {
    classification: {
      proposedTopic: "How Singapore's Government Works",
      proposedSubtopic: "Parliament",
      confidence: 0.9,
      rationale: "The material explains Parliament.",
    },
    candidateClaims: [],
    draft: {
      templateVersion: "briefing-v1",
      title: "Government works",
      sections: [{ section: "Short answer", body: "A draft." }],
    },
    risks: [],
    provider: "reviewed-provider",
    model: "reviewed-model",
    promptVersion: "preparation-v1",
  },
};

describe("DrizzleSourcePreparationRepository persistence mapping", () => {
  it("persists a proposal without creating acceptance, claims, Topics, or Briefings", () => {
    const values = sourcePreparationPersistenceValues(prepared);

    expect(values).toMatchObject({
      id: submission.id,
      idempotencyKey: prepared.idempotencyKey,
      preparationResultState: "prepared",
      processingStatus: "ready-for-review",
      canonicalIdentifier: "youtube:government-video",
      processorOutput: prepared.proposal,
    });
    expect(values).not.toHaveProperty("proposedTopicId");
    expect(JSON.stringify(values)).not.toContain("acceptedSource");
    expect(JSON.stringify(values)).not.toContain('"published"');
  });

  it("round-trips a terminal prepared outcome from the existing Source Submission aggregate", () => {
    const values = sourcePreparationPersistenceValues(prepared);
    if (!("retrievedAt" in values)) throw new Error("Prepared outcomes retain retrieval provenance.");
    const result = mapPersistedSourcePreparation({
      ...persistedRowBase(),
      ...values,
      submittedAt: values.submittedAt,
      retrievedAt: values.retrievedAt,
      processedAt: values.processedAt,
    } as SourceSubmissionRow);

    expect(result).toEqual(prepared);
  });

  it("stores a duplicate only as a linked review outcome", () => {
    const duplicate: SourcePreparationResult = {
      state: "duplicate",
      idempotencyKey: "source-submission:duplicate:v1",
      duplicateOfSubmissionId: "123e4567-e89b-12d3-a456-426614174001",
      provenance: prepared.provenance,
      history: [{ stage: "deduplicated", occurredAt: "2026-08-07T10:01:00.000Z", detail: "Match." }],
    };

    const values = sourcePreparationPersistenceValues(duplicate);

    expect(values).toMatchObject({
      preparationResultState: "duplicate",
      duplicateOfSubmissionId: duplicate.duplicateOfSubmissionId,
    });
    expect(values).not.toHaveProperty("processorOutput");
  });
});

function persistedRowBase() {
  return {
    id: submission.id,
    idempotencyKey: null,
    kind: submission.kind,
    originalIdentifier: submission.originalIdentifier,
    originalUrl: null,
    canonicalIdentifier: null,
    contentFingerprint: null,
    submittedBy: submission.submittedBy,
    submittedAt: new Date(submission.submittedAt),
    retrievedAt: null,
    rightsNote: submission.rightsNote,
    processingStatus: "submitted",
    preparationResultState: null,
    preparationFailure: null,
    duplicateOfSubmissionId: null,
    proposedTopicId: null,
    proposedSubtopic: null,
    classificationConfidence: null,
    classificationRationale: null,
    processingHistory: [],
    processorProvider: null,
    processorModel: null,
    promptVersion: null,
    processorInputProvenance: null,
    processorOutput: null,
    processedAt: null,
    createdAt: new Date(submission.submittedAt),
    updatedAt: new Date(submission.submittedAt),
  };
}
