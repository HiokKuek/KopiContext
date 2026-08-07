import type { FastifyInstance } from "fastify";

import type {
  SourceSubmissionForPreparation,
  SourceSubmissionKind,
} from "@/modules/preparation/source-preparation";
import type {
  QueuedSourceSubmission,
  SourceSubmissionIntakeCommand,
} from "@/modules/preparation/source-submission-intake";

/**
 * The application port behind the source-submission HTTP command. The HTTP
 * layer cannot retrieve material, call an AI provider, or accept evidence on
 * its own; those responsibilities stay behind this use-case boundary.
 */
export type SourceSubmissionCommand = SourceSubmissionIntakeCommand;

type SourceSubmissionRequestBody = Readonly<{
  idempotencyKey: string;
  submission: SourceSubmissionForPreparation;
}>;

type InvalidRequestBody = Readonly<{
  error: Readonly<{
    code: "invalid_request";
    message: "The source-submission request is invalid.";
  }>;
}>;

const sourceSubmissionKinds = new Set<SourceSubmissionKind>(["url", "document", "transcript"]);

/**
 * Registers a private intake endpoint. Authentication is deliberately
 * installed by the API composition root for all non-public `/v1` routes. The
 * response acknowledges durable queueing only; processing happens later in a
 * worker and cannot be mistaken for accepted or published material.
 */
export function registerSourceSubmissionRoute(
  app: FastifyInstance,
  sourceSubmissions: SourceSubmissionCommand,
): void {
  app.post<{ Body: unknown }>("/v1/source-submissions", async (request, reply) => {
    const sourceSubmissionRequest = parseSourceSubmissionRequest(request.body);

    if (!sourceSubmissionRequest) {
      return reply.code(400).send(invalidRequestBody());
    }

    const submission = await sourceSubmissions.queue(sourceSubmissionRequest);
    return reply.code(202).send({ submission: safeQueuedOutcome(submission) });
  });
}

function safeQueuedOutcome(outcome: QueuedSourceSubmission): QueuedSourceSubmission {
  return {
    state: "queued",
    idempotencyKey: outcome.idempotencyKey,
    submissionId: outcome.submissionId,
    queuedAt: outcome.queuedAt,
  };
}

function parseSourceSubmissionRequest(value: unknown): SourceSubmissionRequestBody | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["idempotencyKey", "submission"])) {
    return undefined;
  }

  if (!isNonEmptyString(value.idempotencyKey) || !isRecord(value.submission)) {
    return undefined;
  }

  const submission = value.submission;
  if (
    !hasOnlyKeys(submission, [
      "id",
      "kind",
      "originalIdentifier",
      "submittedBy",
      "submittedAt",
      "rightsNote",
    ]) ||
    !isUuid(submission.id) ||
    !isSourceSubmissionKind(submission.kind) ||
    !isNonEmptyString(submission.originalIdentifier) ||
    !isNonEmptyString(submission.submittedBy) ||
    !isIsoDateTime(submission.submittedAt) ||
    !isNonEmptyString(submission.rightsNote)
  ) {
    return undefined;
  }

  return {
    idempotencyKey: value.idempotencyKey,
    submission: {
      id: submission.id,
      kind: submission.kind,
      originalIdentifier: submission.originalIdentifier,
      submittedBy: submission.submittedBy,
      submittedAt: submission.submittedAt,
      rightsNote: submission.rightsNote,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlyArray<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key)) &&
    allowedKeys.every((key) => key in value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSourceSubmissionKind(value: unknown): value is SourceSubmissionKind {
  return typeof value === "string" && sourceSubmissionKinds.has(value as SourceSubmissionKind);
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function invalidRequestBody(): InvalidRequestBody {
  return {
    error: {
      code: "invalid_request",
      message: "The source-submission request is invalid.",
    },
  };
}
