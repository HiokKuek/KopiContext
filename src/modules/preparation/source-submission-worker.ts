import type { SourcePreparationRequest, SourcePreparationResult } from "./source-preparation";

export type ClaimedSourceSubmission = Readonly<{
  submissionId: string;
  idempotencyKey: string;
  request: SourcePreparationRequest;
  attempt: number;
  workerId: string;
}>;

export type SourceSubmissionWorkerQueue = Readonly<{
  claimNext(input: Readonly<{ workerId: string; now: string; leaseExpiresAt: string }>): Promise<ClaimedSourceSubmission | undefined>;
  scheduleRetry(input: Readonly<{ claim: ClaimedSourceSubmission; retryAt: string; occurredAt: string; error: string }>): Promise<void>;
  escalate(input: Readonly<{ claim: ClaimedSourceSubmission; occurredAt: string; error: string }>): Promise<void>;
}>;

/** Provider-neutral callable supplied only by private worker composition. */
export type SourcePreparationJob = Readonly<{
  prepare(claim: ClaimedSourceSubmission): Promise<SourcePreparationResult>;
}>;

export type SourceSubmissionWorkerOptions = Readonly<{
  workerId: string;
  leaseMs?: number;
  maxAttempts?: number;
  retryDelayMs?: (attempt: number) => number;
  now?: () => Date;
}>;

export type SourceSubmissionWorkerRun =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "prepared"; claim: ClaimedSourceSubmission; result: SourcePreparationResult }>
  | Readonly<{ kind: "retry-scheduled"; claim: ClaimedSourceSubmission }>
  | Readonly<{ kind: "escalated"; claim: ClaimedSourceSubmission }>;

/**
 * Runs at most one durable job. It knows nothing about provider selection:
 * private composition will inject retrieval/AI-backed preparation later.
 */
export function createSourceSubmissionWorker(
  queue: SourceSubmissionWorkerQueue,
  job: SourcePreparationJob,
  options: SourceSubmissionWorkerOptions,
) {
  const now = options.now ?? (() => new Date());
  const leaseMs = options.leaseMs ?? 60_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? ((attempt) => attempt * 30_000);
  if (!options.workerId.trim() || leaseMs < 1 || maxAttempts < 1) throw new Error("Worker options are invalid.");

  return {
    async runOnce(): Promise<SourceSubmissionWorkerRun> {
      const claimedAt = now();
      const claim = await queue.claimNext({
        workerId: options.workerId,
        now: claimedAt.toISOString(),
        leaseExpiresAt: new Date(claimedAt.getTime() + leaseMs).toISOString(),
      });
      if (!claim) return { kind: "idle" };

      try {
        const result = await job.prepare(claim);
        return { kind: "prepared", claim, result };
      } catch (error) {
        const occurredAt = now().toISOString();
        const message = safeErrorMessage(error);
        if (claim.attempt >= maxAttempts) {
          await queue.escalate({ claim, occurredAt, error: message });
          return { kind: "escalated", claim };
        }
        const retryAt = new Date(new Date(occurredAt).getTime() + retryDelayMs(claim.attempt)).toISOString();
        await queue.scheduleRetry({ claim, retryAt, occurredAt, error: message });
        return { kind: "retry-scheduled", claim };
      }
    },
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 1_000);
  return "Preparation job failed without a safe error message.";
}
