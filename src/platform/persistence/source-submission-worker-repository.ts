import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { PreparationTrace } from "@/modules/preparation/source-preparation";
import type { ClaimedSourceSubmission, SourceSubmissionWorkerQueue } from "@/modules/preparation/source-submission-worker";

import { sourceSubmissions, type SourceSubmissionRow } from "./schema";

/** Postgres `FOR UPDATE SKIP LOCKED` adapter for the private worker process. */
export class DrizzleSourceSubmissionWorkerQueue implements SourceSubmissionWorkerQueue {
  constructor(private readonly db: NodePgDatabase) {}

  async claimNext(input: Readonly<{ workerId: string; now: string; leaseExpiresAt: string }>): Promise<ClaimedSourceSubmission | undefined> {
    const now = new Date(input.now);
    const leaseExpiresAt = new Date(input.leaseExpiresAt);
    return this.db.transaction(async (transaction) => {
      const [candidate] = await transaction
        .select()
        .from(sourceSubmissions)
        .where(and(
          or(
            eq(sourceSubmissions.processingStatus, "submitted"),
            and(eq(sourceSubmissions.processingStatus, "processing"), lte(sourceSubmissions.processingLeaseExpiresAt, now)),
          ),
          or(isNull(sourceSubmissions.nextAttemptAt), lte(sourceSubmissions.nextAttemptAt, now)),
          isNull(sourceSubmissions.preparationResultState),
        ))
        .orderBy(asc(sourceSubmissions.createdAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return undefined;

      const attempt = candidate.processingAttemptCount + 1;
      const history = [...historyOf(candidate), { stage: "processing" as never, occurredAt: input.now, detail: `Claimed by ${input.workerId}.` }];
      const [claimed] = await transaction.update(sourceSubmissions).set({
        processingStatus: "processing", processingAttemptCount: attempt, nextAttemptAt: null,
        processingStartedAt: now, processingLeaseExpiresAt: leaseExpiresAt, processingWorkerId: input.workerId,
        processingHistory: history, updatedAt: now,
      }).where(eq(sourceSubmissions.id, candidate.id)).returning();
      return claimed ? claimedSubmission(claimed, attempt, input.workerId) : undefined;
    });
  }

  async scheduleRetry(input: Readonly<{ claim: ClaimedSourceSubmission; retryAt: string; occurredAt: string; error: string }>): Promise<void> {
    await this.updateClaim(input.claim, {
      processingStatus: "submitted", nextAttemptAt: new Date(input.retryAt), processingStartedAt: null,
      processingLeaseExpiresAt: null, processingWorkerId: null, lastProcessingError: input.error,
      processingHistory: { stage: "retry-scheduled", occurredAt: input.occurredAt, detail: "Worker failure; retry scheduled." }, updatedAt: new Date(input.occurredAt),
    });
  }

  async escalate(input: Readonly<{ claim: ClaimedSourceSubmission; occurredAt: string; error: string }>): Promise<void> {
    await this.updateClaim(input.claim, {
      processingStatus: "escalated", nextAttemptAt: null, processingLeaseExpiresAt: null,
      lastProcessingError: input.error,
      processingHistory: { stage: "escalated", occurredAt: input.occurredAt, detail: "Worker attempt limit reached; editorial review is required." }, updatedAt: new Date(input.occurredAt),
    });
  }

  private async updateClaim(claim: ClaimedSourceSubmission, update: Record<string, unknown> & { processingHistory: PreparationTrace }): Promise<void> {
    const [row] = await this.db.select().from(sourceSubmissions).where(and(eq(sourceSubmissions.id, claim.submissionId), eq(sourceSubmissions.processingWorkerId, claim.workerId), eq(sourceSubmissions.processingStatus, "processing"))).limit(1);
    if (!row) return;
    await this.db.update(sourceSubmissions).set({ ...update, processingHistory: [...historyOf(row), update.processingHistory] }).where(and(eq(sourceSubmissions.id, claim.submissionId), eq(sourceSubmissions.processingWorkerId, claim.workerId), eq(sourceSubmissions.processingStatus, "processing")));
  }
}

function claimedSubmission(row: SourceSubmissionRow, attempt: number, workerId: string): ClaimedSourceSubmission {
  if (!row.idempotencyKey) throw new Error("Queued Source Submission is missing an idempotency key.");
  return { submissionId: row.id, idempotencyKey: row.idempotencyKey, attempt, workerId, request: { idempotencyKey: row.idempotencyKey, submission: { id: row.id, kind: row.kind, originalIdentifier: row.originalIdentifier, submittedBy: row.submittedBy, submittedAt: row.submittedAt.toISOString(), rightsNote: row.rightsNote } } };
}

function historyOf(row: SourceSubmissionRow): PreparationTrace[] {
  return Array.isArray(row.processingHistory) ? row.processingHistory as PreparationTrace[] : [];
}
