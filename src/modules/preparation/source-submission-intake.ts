import type {
  SourcePreparationRequest,
  SourceSubmissionForPreparation,
} from "./source-preparation";

/** A safe acknowledgement: no material has been retrieved or interpreted yet. */
export type QueuedSourceSubmission = Readonly<{
  state: "queued";
  idempotencyKey: string;
  submissionId: string;
  queuedAt: string;
}>;

/**
 * The storage/queue port for source intake. A production implementation must
 * atomically retain the submission and make it available to a private worker.
 */
export type SourceSubmissionIntakeRepository = Readonly<{
  enqueue(request: SourcePreparationRequest, queuedAt: string): Promise<QueuedSourceSubmission>;
}>;

export type SourceSubmissionIntakeCommand = Readonly<{
  queue(request: SourcePreparationRequest): Promise<QueuedSourceSubmission>;
}>;

export type SourceSubmissionIntakeDependencies = Readonly<{
  now?: () => Date;
}>;

/**
 * Retains the request and returns immediately. It deliberately does not use a
 * retrieval adapter, provider, duplicate detector, Accepted Source, Claim,
 * Topic, Briefing, or editorial workflow port.
 */
export function createSourceSubmissionIntakeCommand(
  repository: SourceSubmissionIntakeRepository,
  dependencies: SourceSubmissionIntakeDependencies = {},
): SourceSubmissionIntakeCommand {
  const now = dependencies.now ?? (() => new Date());

  return {
    queue(request) {
      return repository.enqueue(request, now().toISOString());
    },
  };
}

/** Shared typed input for transports that submit material into the worker queue. */
export type SourceSubmissionIntakeRequest = Readonly<{
  idempotencyKey: string;
  submission: SourceSubmissionForPreparation;
}>;
