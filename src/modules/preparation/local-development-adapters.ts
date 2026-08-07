import { createHash } from "node:crypto";

import {
  prepareSourceSubmission,
  type AgentPreparationProposal,
  type Clock,
  type DuplicateDetectionAdapter,
  type PreparationAiAdapter,
  type RetrievedMaterial,
  type SourcePreparationRequest,
  type SourcePreparationResult,
  type SourcePreparationStore,
  type SourceRetrievalAdapter,
} from "./source-preparation";

/**
 * Explicit local material, deliberately limited to editor-supplied transcript
 * fixtures. It is not a URL fetcher or document parser.
 */
export type LocalTranscriptFixture = Readonly<{
  identifier: string;
  text: string;
  canonicalIdentifier?: string;
}>;

export type LocalSourcePreparationCommand = Readonly<{
  prepare(request: SourcePreparationRequest): Promise<SourcePreparationResult>;
}>;

export type LocalSourcePreparationOptions = Readonly<{
  transcripts: ReadonlyArray<LocalTranscriptFixture>;
  clock?: Clock;
  minimumConfidence?: number;
}>;

type DuplicateRecord = Readonly<{
  submissionId: string;
  canonicalIdentifier: string;
  contentFingerprint: string;
}>;

/**
 * A deterministic, local-only retrieval adapter. Network retrieval is
 * intentionally absent: a URL or document Source Submission fails until a
 * proper production adapter is composed by the private runtime.
 */
export function createLocalTranscriptRetrieval(
  fixtures: ReadonlyArray<LocalTranscriptFixture>,
): SourceRetrievalAdapter {
  const materials = new Map<string, RetrievedMaterial>();

  for (const fixture of fixtures) {
    if (!hasText(fixture.identifier) || !hasText(fixture.text)) {
      throw new Error("Local transcript fixtures require a non-empty identifier and text.");
    }
    if (materials.has(fixture.identifier)) {
      throw new Error(`Local transcript fixture is duplicated: ${fixture.identifier}`);
    }

    materials.set(fixture.identifier, {
      canonicalIdentifier: fixture.canonicalIdentifier ?? fixture.identifier,
      text: fixture.text,
      contentFingerprint: fingerprint(fixture.text),
      retrievedFrom: "local-transcript-registry",
    });
  }

  return {
    async retrieve(submission) {
      if (submission.kind !== "transcript") {
        throw new Error("Local development retrieval supports registered transcripts only.");
      }

      const material = materials.get(submission.originalIdentifier);
      if (!material) {
        throw new Error("No registered local transcript matches this Source Submission.");
      }

      return clone(material);
    },
  };
}

/**
 * A serializable in-memory store and duplicate detector for development and
 * tests. It retains neither files nor network state and is lost on restart.
 */
export function createInMemoryPreparationStore(): SourcePreparationStore & DuplicateDetectionAdapter {
  const results = new Map<string, SourcePreparationResult>();
  const duplicateRecords: DuplicateRecord[] = [];

  return {
    async findByIdempotencyKey(idempotencyKey) {
      const result = results.get(idempotencyKey);
      return result ? clone(result) : undefined;
    },
    async save(result) {
      const saved = clone(result);
      results.set(saved.idempotencyKey, saved);

      if (saved.state !== "prepared" && saved.state !== "needs-review") return;

      duplicateRecords.push({
        submissionId: saved.provenance.submission.id,
        canonicalIdentifier: saved.provenance.retrieval.canonicalIdentifier,
        contentFingerprint: saved.provenance.retrieval.contentFingerprint,
      });
    },
    async findDuplicate(input) {
      const duplicate = duplicateRecords.find(
        (record) =>
          record.submissionId !== input.excludingSubmissionId &&
          (record.canonicalIdentifier === input.canonicalIdentifier ||
            record.contentFingerprint === input.contentFingerprint),
      );
      return duplicate ? { submissionId: duplicate.submissionId } : undefined;
    },
  };
}

/**
 * This is intentionally not a model integration. Its proposal only makes the
 * local workflow inspectable and always requires Editorial Approval before
 * any use. Production composition must replace it with a reviewed provider
 * adapter for rights-cleared material.
 */
export function createLocalDevelopmentPreparationAi(): PreparationAiAdapter {
  return {
    async prepare({ submission }): Promise<AgentPreparationProposal> {
      return {
        classification: {
          proposedTopic: "Unassigned Topic",
          confidence: 0,
          rationale: "A local development placeholder cannot classify submitted material.",
        },
        candidateClaims: [],
        draft: {
          templateVersion: "briefing-v1",
          title: "Editorial review required",
          sections: [
            {
              section: "Review notes",
              body: `Local placeholder only: review Source Submission ${submission.id} before drafting.`,
            },
          ],
        },
        risks: ["Local development placeholder: no external AI was called; editorial review is required."],
        provider: "local-development-placeholder",
        model: "no-external-ai",
        promptVersion: "local-placeholder-v1",
      };
    },
  };
}

/**
 * Convenience composition for the local private-runtime/test mode. It is
 * framework-neutral and intentionally leaves Fastify, database, queues, and
 * production provider wiring outside this module.
 */
export function createLocalSourcePreparationCommand(
  options: LocalSourcePreparationOptions,
): LocalSourcePreparationCommand {
  const store = createInMemoryPreparationStore();
  const dependencies = {
    retrieval: createLocalTranscriptRetrieval(options.transcripts),
    duplicates: store,
    ai: createLocalDevelopmentPreparationAi(),
    store,
    clock: options.clock ?? { now: () => new Date().toISOString() },
    minimumConfidence: options.minimumConfidence,
  };

  return {
    prepare(request) {
      return prepareSourceSubmission(request, dependencies);
    },
  };
}

function fingerprint(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}
