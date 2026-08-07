import { and, eq, inArray, ne, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  AgentPreparationProposal,
  DuplicateDetectionAdapter,
  DuplicatePreparationResult,
  FailedPreparationResult,
  PreparationProvenance,
  PreparationTrace,
  PreparedSourceSubmissionResult,
  SourcePreparationResult,
  SourcePreparationStore,
  SourceSubmissionForPreparation,
} from "@/modules/preparation/source-preparation";

import { sourceSubmissions, type SourceSubmissionRow } from "./schema";

/**
 * The durable worker-facing store for Source Submission preparation. It owns
 * persistence only: retrieval, model invocation, acceptance, Topic creation,
 * and publication remain outside this adapter.
 */
export class DrizzleSourcePreparationRepository
  implements SourcePreparationStore, DuplicateDetectionAdapter
{
  constructor(private readonly db: NodePgDatabase) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<SourcePreparationResult | undefined> {
    const [row] = await this.db
      .select()
      .from(sourceSubmissions)
      .where(eq(sourceSubmissions.idempotencyKey, idempotencyKey))
      .limit(1);

    return row ? mapPersistedSourcePreparation(row) : undefined;
  }

  /**
   * The unique command key makes a completed outcome durable. If another
   * worker has committed first, return that outcome instead of overwriting it.
   */
  async save(result: SourcePreparationResult): Promise<SourcePreparationResult> {
    const inserted = await this.db
      .insert(sourceSubmissions)
      .values(sourcePreparationPersistenceValues(result))
      .onConflictDoNothing({ target: sourceSubmissions.idempotencyKey })
      .returning({ idempotencyKey: sourceSubmissions.idempotencyKey });

    if (inserted.length === 1) {
      return result;
    }

    const existing = await this.findByIdempotencyKey(result.idempotencyKey);
    if (existing) return existing;

    throw new Error("Source preparation outcome could not be persisted or recovered by idempotency key.");
  }

  async findDuplicate(input: {
    canonicalIdentifier: string;
    contentFingerprint: string;
    excludingSubmissionId: string;
  }): Promise<{ submissionId: string } | undefined> {
    const [duplicate] = await this.db
      .select({ submissionId: sourceSubmissions.id })
      .from(sourceSubmissions)
      .where(
        and(
          ne(sourceSubmissions.id, input.excludingSubmissionId),
          inArray(sourceSubmissions.preparationResultState, ["prepared", "needs-review"]),
          or(
            eq(sourceSubmissions.canonicalIdentifier, input.canonicalIdentifier),
            eq(sourceSubmissions.contentFingerprint, input.contentFingerprint),
          ),
        ),
      )
      .limit(1);

    return duplicate;
  }
}

/**
 * Maps an advisory preparation outcome into the existing Source Submission
 * aggregate. In particular, it never emits rows for accepted sources, claims,
 * Topics, Briefings, or editorial audit records.
 */
export function sourcePreparationPersistenceValues(result: SourcePreparationResult) {
  const submission = submissionFor(result);
  const common = {
    id: submission.id,
    idempotencyKey: result.idempotencyKey,
    kind: submission.kind,
    originalIdentifier: submission.originalIdentifier,
    originalUrl: submission.kind === "url" ? submission.originalIdentifier : null,
    submittedBy: submission.submittedBy,
    submittedAt: asDate(submission.submittedAt),
    rightsNote: submission.rightsNote,
    processingHistory: result.history,
    updatedAt: new Date(),
  };

  if (result.state === "failed") {
    return {
      ...common,
      processingStatus: "rejected" as const,
      preparationResultState: "failed" as const,
      preparationFailure: result.failure,
      processedAt: latestHistoryDate(result.history),
    };
  }

  const provenance = result.provenance;
  const retrieval = {
    canonicalIdentifier: provenance.retrieval.canonicalIdentifier,
    contentFingerprint: provenance.retrieval.contentFingerprint,
    retrievedAt: asDate(provenance.retrieval.retrievedAt),
  };

  if (result.state === "duplicate") {
    return {
      ...common,
      ...retrieval,
      processingStatus: "rejected" as const,
      preparationResultState: "duplicate" as const,
      duplicateOfSubmissionId: result.duplicateOfSubmissionId,
      processedAt: latestHistoryDate(result.history),
    };
  }

  return {
    ...common,
    ...retrieval,
    processingStatus: result.state === "prepared" ? ("ready-for-review" as const) : ("escalated" as const),
    preparationResultState: result.state,
    proposedSubtopic: result.proposal.classification.proposedSubtopic ?? null,
    classificationConfidence: String(result.proposal.classification.confidence),
    classificationRationale: result.proposal.classification.rationale,
    processorProvider: result.proposal.provider,
    processorModel: result.proposal.model,
    promptVersion: result.proposal.promptVersion,
    processorInputProvenance: preparationInputProvenance(provenance),
    processorOutput: result.proposal,
    processedAt: latestHistoryDate(result.history),
  };
}

/** Reconstructs the application contract and fails closed for malformed rows. */
export function mapPersistedSourcePreparation(row: SourceSubmissionRow): SourcePreparationResult {
  const submission = persistedSubmission(row);
  const history = asHistory(row.processingHistory);

  switch (row.preparationResultState) {
    case "failed":
      if (!isFailure(row.preparationFailure)) throw malformed(row.id, "a preparation failure");
      return {
        state: "failed",
        idempotencyKey: required(row.idempotencyKey, row.id, "an idempotency key"),
        submission,
        history,
        failure: row.preparationFailure,
      } satisfies FailedPreparationResult;
    case "duplicate":
      return {
        state: "duplicate",
        idempotencyKey: required(row.idempotencyKey, row.id, "an idempotency key"),
        duplicateOfSubmissionId: required(row.duplicateOfSubmissionId, row.id, "a duplicate target"),
        provenance: persistedProvenance(row, submission),
        history,
      } satisfies DuplicatePreparationResult;
    case "prepared":
    case "needs-review": {
      const proposal = asProposal(row.processorOutput, row.id);
      return {
        state: row.preparationResultState,
        idempotencyKey: required(row.idempotencyKey, row.id, "an idempotency key"),
        provenance: persistedProvenance(row, submission, proposal),
        history,
        proposal,
      } satisfies PreparedSourceSubmissionResult;
    }
    default:
      throw malformed(row.id, "a terminal preparation result");
  }
}

function submissionFor(result: SourcePreparationResult): SourceSubmissionForPreparation {
  return result.state === "failed" ? result.submission : result.provenance.submission;
}

function persistedSubmission(row: SourceSubmissionRow): SourceSubmissionForPreparation {
  return {
    id: row.id,
    kind: row.kind,
    originalIdentifier: row.originalIdentifier,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt.toISOString(),
    rightsNote: row.rightsNote,
  };
}

function persistedProvenance(
  row: SourceSubmissionRow,
  submission: SourceSubmissionForPreparation,
  proposal?: AgentPreparationProposal,
): PreparationProvenance {
  const canonicalIdentifier = required(row.canonicalIdentifier, row.id, "a canonical identifier");
  const contentFingerprint = required(row.contentFingerprint, row.id, "a content fingerprint");
  const retrievedAt = required(row.retrievedAt, row.id, "a retrieval timestamp");
  const input = isRecord(row.processorInputProvenance) ? row.processorInputProvenance : undefined;
  const retrievedFrom = typeof input?.retrievedFrom === "string" ? input.retrievedFrom : "unknown";

  return {
    submission,
    retrieval: {
      canonicalIdentifier,
      contentFingerprint,
      retrievedAt: retrievedAt.toISOString(),
      retrievedFrom,
    },
    ...(proposal
      ? {
          ai: {
            provider: proposal.provider,
            model: proposal.model,
            promptVersion: proposal.promptVersion,
            inputFingerprint: contentFingerprint,
          },
        }
      : {}),
  };
}

function preparationInputProvenance(provenance: PreparationProvenance) {
  return {
    canonicalIdentifier: provenance.retrieval.canonicalIdentifier,
    contentFingerprint: provenance.retrieval.contentFingerprint,
    retrievedAt: provenance.retrieval.retrievedAt,
    retrievedFrom: provenance.retrieval.retrievedFrom,
  };
}

function asHistory(value: unknown): PreparationTrace[] {
  if (!Array.isArray(value) || !value.every(isTrace)) {
    throw new Error("Persisted Source Submission has malformed preparation history.");
  }
  return value;
}

function isTrace(value: unknown): value is PreparationTrace {
  if (!isRecord(value)) return false;
  return (
    (value.stage === "retrieved" ||
      value.stage === "deduplicated" ||
      value.stage === "prepared" ||
      value.stage === "escalated" ||
      value.stage === "failed") &&
    typeof value.occurredAt === "string" &&
    typeof value.detail === "string"
  );
}

function asProposal(value: unknown, submissionId: string): AgentPreparationProposal {
  if (!isRecord(value) || !isRecord(value.classification) || !isRecord(value.draft)) {
    throw malformed(submissionId, "a preparation proposal");
  }
  if (
    typeof value.classification.proposedTopic !== "string" ||
    typeof value.classification.confidence !== "number" ||
    typeof value.classification.rationale !== "string" ||
    typeof value.draft.templateVersion !== "string" ||
    typeof value.draft.title !== "string" ||
    !Array.isArray(value.draft.sections) ||
    !Array.isArray(value.candidateClaims) ||
    !Array.isArray(value.risks) ||
    typeof value.provider !== "string" ||
    typeof value.model !== "string" ||
    typeof value.promptVersion !== "string"
  ) {
    throw malformed(submissionId, "a preparation proposal");
  }

  return value as AgentPreparationProposal;
}

function latestHistoryDate(history: ReadonlyArray<PreparationTrace>): Date {
  const latest = history.at(-1);
  if (!latest) throw new Error("A Source Submission preparation outcome must have history.");
  return asDate(latest.occurredAt);
}

function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Source Submission preparation contains an invalid timestamp.");
  return date;
}

function required<T>(value: T | null | undefined, id: string, description: string): T {
  if (value === null || value === undefined) throw malformed(id, description);
  return value;
}

function malformed(id: string, description: string): Error {
  return new Error(`Persisted Source Submission ${id} is missing ${description}.`);
}

function isFailure(value: unknown): value is FailedPreparationResult["failure"] {
  return value === "retrieval-failed" || value === "preparation-failed" || value === "invalid-proposal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
