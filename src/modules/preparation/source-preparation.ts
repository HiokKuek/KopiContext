/**
 * The sole application boundary for turning a Source Submission into material
 * an editor can review. This module deliberately has no dependency on Next.js,
 * a database, a queue, or an AI SDK; callers supply those capabilities as
 * adapters. Its output is a proposal, never accepted evidence or published
 * content.
 */

export type SourceSubmissionKind = "url" | "document" | "transcript";

export type SourceSubmissionForPreparation = {
  id: string;
  kind: SourceSubmissionKind;
  originalIdentifier: string;
  submittedBy: string;
  submittedAt: string;
  rightsNote: string;
};

export type RetrievedMaterial = {
  canonicalIdentifier: string;
  text: string;
  contentFingerprint: string;
  retrievedFrom: string;
};

export type ClassificationProposal = {
  proposedTopic: string;
  proposedSubtopic?: string;
  confidence: number;
  rationale: string;
};

/** A candidate fact tied to a passage in submitted material, not a Claim. */
export type CandidateClaimProposal = {
  statement: string;
  excerpt: string;
  supportingSubmissionId: string;
  confidence: number;
  rationale: string;
};

export type BriefingDraftProposal = {
  templateVersion: string;
  title: string;
  sections: ReadonlyArray<{ section: string; body: string }>;
};

export type AgentPreparationProposal = {
  classification: ClassificationProposal;
  candidateClaims: ReadonlyArray<CandidateClaimProposal>;
  draft: BriefingDraftProposal;
  risks: ReadonlyArray<string>;
  provider: string;
  model: string;
  promptVersion: string;
};

export type PreparationTrace = {
  stage: "retrieved" | "deduplicated" | "prepared" | "escalated" | "failed";
  occurredAt: string;
  detail: string;
};

export type PreparationProvenance = {
  submission: SourceSubmissionForPreparation;
  retrieval: {
    canonicalIdentifier: string;
    retrievedFrom: string;
    retrievedAt: string;
    contentFingerprint: string;
  };
  ai?: {
    provider: string;
    model: string;
    promptVersion: string;
    inputFingerprint: string;
  };
};

export type DuplicatePreparationResult = {
  state: "duplicate";
  idempotencyKey: string;
  duplicateOfSubmissionId: string;
  provenance: PreparationProvenance;
  history: ReadonlyArray<PreparationTrace>;
};

export type PreparedSourceSubmissionResult = {
  state: "prepared" | "needs-review";
  idempotencyKey: string;
  provenance: PreparationProvenance;
  history: ReadonlyArray<PreparationTrace>;
  proposal: AgentPreparationProposal;
};

export type FailedPreparationResult = {
  state: "failed";
  idempotencyKey: string;
  submission: SourceSubmissionForPreparation;
  history: ReadonlyArray<PreparationTrace>;
  failure: "retrieval-failed" | "preparation-failed" | "invalid-proposal";
};

export type SourcePreparationResult =
  | DuplicatePreparationResult
  | PreparedSourceSubmissionResult
  | FailedPreparationResult;

export type SourcePreparationRequest = {
  idempotencyKey: string;
  submission: SourceSubmissionForPreparation;
};

export type SourceRetrievalAdapter = {
  retrieve(submission: SourceSubmissionForPreparation): Promise<RetrievedMaterial>;
};

export type DuplicateDetectionAdapter = {
  findDuplicate(input: {
    canonicalIdentifier: string;
    contentFingerprint: string;
    excludingSubmissionId: string;
  }): Promise<{ submissionId: string } | undefined>;
};

export type PreparationAiAdapter = {
  prepare(input: {
    submission: SourceSubmissionForPreparation;
    material: RetrievedMaterial;
  }): Promise<AgentPreparationProposal>;
};

export type SourcePreparationStore = {
  findByIdempotencyKey(idempotencyKey: string): Promise<SourcePreparationResult | undefined>;
  save(result: SourcePreparationResult): Promise<void>;
};

export type Clock = { now(): string };

export type PrepareSourceSubmissionDependencies = {
  retrieval: SourceRetrievalAdapter;
  duplicates: DuplicateDetectionAdapter;
  ai: PreparationAiAdapter;
  store: SourcePreparationStore;
  clock: Clock;
  minimumConfidence?: number;
};

const defaultMinimumConfidence = 0.8;

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function isConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidProposal(proposal: AgentPreparationProposal, submissionId: string): boolean {
  return (
    hasText(proposal.classification.proposedTopic) &&
    hasText(proposal.classification.rationale) &&
    isConfidence(proposal.classification.confidence) &&
    hasText(proposal.draft.templateVersion) &&
    hasText(proposal.draft.title) &&
    proposal.draft.sections.length > 0 &&
    proposal.draft.sections.every((section) => hasText(section.section) && hasText(section.body)) &&
    hasText(proposal.provider) &&
    hasText(proposal.model) &&
    hasText(proposal.promptVersion) &&
    proposal.candidateClaims.every(
      (claim) =>
        hasText(claim.statement) &&
        hasText(claim.excerpt) &&
        claim.supportingSubmissionId === submissionId &&
        hasText(claim.rationale) &&
        isConfidence(claim.confidence),
    )
  );
}

function needsEditorialReview(proposal: AgentPreparationProposal, minimumConfidence: number): boolean {
  return (
    proposal.risks.length > 0 ||
    proposal.classification.confidence < minimumConfidence ||
    proposal.candidateClaims.some((claim) => claim.confidence < minimumConfidence)
  );
}

async function saveAndReturn(
  store: SourcePreparationStore,
  result: SourcePreparationResult,
): Promise<SourcePreparationResult> {
  await store.save(result);
  return result;
}

/**
 * Produces an idempotent, auditable preparation outcome. A successful result
 * cannot accept a Source, alter canonical Topic taxonomy, or invoke publishing:
 * it only contains editor-reviewable suggestions anchored to the Submission.
 */
export async function prepareSourceSubmission(
  request: SourcePreparationRequest,
  dependencies: PrepareSourceSubmissionDependencies,
): Promise<SourcePreparationResult> {
  const existing = await dependencies.store.findByIdempotencyKey(request.idempotencyKey);
  if (existing) return existing;

  const history: PreparationTrace[] = [];
  let material: RetrievedMaterial;
  try {
    material = await dependencies.retrieval.retrieve(request.submission);
  } catch {
    const occurredAt = dependencies.clock.now();
    return saveAndReturn(dependencies.store, {
      state: "failed",
      idempotencyKey: request.idempotencyKey,
      submission: request.submission,
      history: [{ stage: "failed", occurredAt, detail: "Material could not be retrieved." }],
      failure: "retrieval-failed",
    });
  }

  const retrievedAt = dependencies.clock.now();
  const provenance: PreparationProvenance = {
    submission: request.submission,
    retrieval: {
      canonicalIdentifier: material.canonicalIdentifier,
      retrievedFrom: material.retrievedFrom,
      retrievedAt,
      contentFingerprint: material.contentFingerprint,
    },
  };
  history.push({ stage: "retrieved", occurredAt: retrievedAt, detail: "Material retained for assessment." });

  const duplicate = await dependencies.duplicates.findDuplicate({
    canonicalIdentifier: material.canonicalIdentifier,
    contentFingerprint: material.contentFingerprint,
    excludingSubmissionId: request.submission.id,
  });
  if (duplicate) {
    const occurredAt = dependencies.clock.now();
    history.push({ stage: "deduplicated", occurredAt, detail: "A matching submission already exists." });
    return saveAndReturn(dependencies.store, {
      state: "duplicate",
      idempotencyKey: request.idempotencyKey,
      duplicateOfSubmissionId: duplicate.submissionId,
      provenance,
      history,
    });
  }

  let proposal: AgentPreparationProposal;
  try {
    proposal = await dependencies.ai.prepare({ submission: request.submission, material });
  } catch {
    const occurredAt = dependencies.clock.now();
    history.push({ stage: "failed", occurredAt, detail: "Preparation could not be completed." });
    return saveAndReturn(dependencies.store, {
      state: "failed",
      idempotencyKey: request.idempotencyKey,
      submission: request.submission,
      history,
      failure: "preparation-failed",
    });
  }

  if (!isValidProposal(proposal, request.submission.id)) {
    const occurredAt = dependencies.clock.now();
    history.push({ stage: "failed", occurredAt, detail: "The preparation proposal did not meet review requirements." });
    return saveAndReturn(dependencies.store, {
      state: "failed",
      idempotencyKey: request.idempotencyKey,
      submission: request.submission,
      history,
      failure: "invalid-proposal",
    });
  }

  const preparedAt = dependencies.clock.now();
  const requiresReview = needsEditorialReview(proposal, dependencies.minimumConfidence ?? defaultMinimumConfidence);
  history.push({
    stage: requiresReview ? "escalated" : "prepared",
    occurredAt: preparedAt,
    detail: requiresReview ? "Editorial review is required before any use." : "Proposal is ready for editorial review.",
  });
  return saveAndReturn(dependencies.store, {
    state: requiresReview ? "needs-review" : "prepared",
    idempotencyKey: request.idempotencyKey,
    provenance: {
      ...provenance,
      ai: {
        provider: proposal.provider,
        model: proposal.model,
        promptVersion: proposal.promptVersion,
        inputFingerprint: material.contentFingerprint,
      },
    },
    history,
    proposal,
  });
}
