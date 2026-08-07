import {
  type TopicRequest,
  type TopicRequestSubmission,
  type TopicRequestTransport,
  type TopicRequestValidationFailure,
  validateTopicRequest,
} from "./topic-request";

/**
 * One accepted anonymous request is immediately folded into an aggregate. The
 * repository deliberately has no reader, session, header, IP, idempotency, or
 * free-form data fields, making a per-person request log impossible here.
 */
export type TopicRequestDemandRepository = Readonly<{
  recordAcceptedDemand(input: Readonly<{
    requestedTopic: string;
    acceptedAt: string;
  }>): Promise<void> | void;
  listDemand(): Promise<ReadonlyArray<TopicRequestDemand>> | ReadonlyArray<TopicRequestDemand>;
}>;

/** A privacy-bounded editor queue item, ordered by the repository on read. */
export type TopicRequestDemand = Readonly<{
  requestedTopic: string;
  requestCount: number;
  firstRequestedAt: string;
  lastRequestedAt: string;
}>;

export type TopicRequestCommandDependencies = Readonly<{
  now?: () => Date;
}>;

export class TopicRequestRejectedError extends Error {
  constructor(readonly reason: TopicRequestValidationFailure["reason"]) {
    super(`Topic request was rejected: ${reason}.`);
  }
}

/**
 * The trusted-server command behind `TopicRequestTransport`. It repeats
 * validation at the application boundary: an authenticated caller is not a
 * reason to retain a malformed or personal Topic request.
 */
export function createTopicRequestCommand(
  repository: TopicRequestDemandRepository,
  dependencies: TopicRequestCommandDependencies = {},
): TopicRequestTransport {
  const now = dependencies.now ?? (() => new Date());

  return {
    async submit(request: TopicRequest): Promise<TopicRequestSubmission> {
      const validation = validateTopicRequest(request);
      if (!validation.ok) {
        throw new TopicRequestRejectedError(validation.reason);
      }

      await repository.recordAcceptedDemand({
        requestedTopic: validation.request.requestedTopic,
        acceptedAt: now().toISOString(),
      });

      return { status: "received" };
    },
  };
}
