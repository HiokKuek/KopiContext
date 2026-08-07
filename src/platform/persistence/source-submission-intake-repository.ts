import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { SourcePreparationRequest } from "@/modules/preparation/source-preparation";
import type {
  QueuedSourceSubmission,
  SourceSubmissionIntakeRepository,
} from "@/modules/preparation/source-submission-intake";

import { sourceSubmissions } from "./schema";

/**
 * A durable database-backed worker intake queue. `submitted` means material
 * is waiting for a worker; it has not been retrieved or prepared.
 */
export class DrizzleSourceSubmissionIntakeRepository implements SourceSubmissionIntakeRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async enqueue(
    request: SourcePreparationRequest,
    queuedAt: string,
  ): Promise<QueuedSourceSubmission> {
    const queuedAtDate = asDate(queuedAt);
    const inserted = await this.db
      .insert(sourceSubmissions)
      .values({
        id: request.submission.id,
        idempotencyKey: request.idempotencyKey,
        kind: request.submission.kind,
        originalIdentifier: request.submission.originalIdentifier,
        originalUrl:
          request.submission.kind === "url" ? request.submission.originalIdentifier : null,
        submittedBy: request.submission.submittedBy,
        submittedAt: asDate(request.submission.submittedAt),
        rightsNote: request.submission.rightsNote,
        processingStatus: "submitted",
        processingHistory: [
          {
            stage: "queued",
            occurredAt: queuedAt,
            detail: "Awaiting a private preparation worker.",
          },
        ],
        createdAt: queuedAtDate,
        updatedAt: queuedAtDate,
      })
      .onConflictDoNothing({ target: sourceSubmissions.idempotencyKey })
      .returning({
        id: sourceSubmissions.id,
        idempotencyKey: sourceSubmissions.idempotencyKey,
        createdAt: sourceSubmissions.createdAt,
      });

    if (inserted.length === 1) {
      return queuedOutcome(inserted[0]);
    }

    // A retry returns the original queued result. It does not requeue, mutate
    // provenance, or invoke any processor.
    const [existing] = await this.db
      .select({
        id: sourceSubmissions.id,
        idempotencyKey: sourceSubmissions.idempotencyKey,
        createdAt: sourceSubmissions.createdAt,
      })
      .from(sourceSubmissions)
      .where(eq(sourceSubmissions.idempotencyKey, request.idempotencyKey))
      .limit(1);

    if (!existing?.idempotencyKey) {
      throw new Error("Source Submission intake could not recover its idempotent queue record.");
    }

    return queuedOutcome(existing);
  }
}

function queuedOutcome(record: Readonly<{ id: string; idempotencyKey: string | null; createdAt: Date }>): QueuedSourceSubmission {
  if (!record.idempotencyKey) {
    throw new Error("Persisted Source Submission is missing an idempotency key.");
  }
  return {
    state: "queued",
    idempotencyKey: record.idempotencyKey,
    submissionId: record.id,
    queuedAt: record.createdAt.toISOString(),
  };
}

function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Source Submission intake contains an invalid timestamp.");
  }
  return date;
}
