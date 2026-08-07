import "server-only";

import type {
  SourcePreparationRequest,
  SourceSubmissionKind,
} from "@/modules/preparation/source-preparation";
import type { QueuedSourceSubmission } from "@/modules/preparation/source-submission-intake";

import { createPrivateApiClient, type PrivateApiClient } from "./private-api-client";

const SOURCE_SUBMISSION_PATH = "/v1/source-submissions";

export type SourceSubmissionQueueTransport = Readonly<{
  queue(request: SourcePreparationRequest): Promise<QueuedSourceSubmission>;
}>;

/**
 * Server-only bridge to the private source-intake command. It receives a
 * fully constructed request from trusted server code, never from a browser.
 */
export function createSourceSubmissionBff(
  privateApi: Pick<PrivateApiClient, "command">,
): SourceSubmissionQueueTransport {
  return {
    async queue(request) {
      const response = await privateApi.command<unknown>({
        path: SOURCE_SUBMISSION_PATH,
        method: "POST",
        body: request,
      });
      if (!isQueuedResponse(response)) {
        throw new Error("The private API returned an invalid Source Submission queue response.");
      }
      return response.submission;
    },
  };
}

export function createSourceSubmissionBffFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SourceSubmissionQueueTransport {
  return createSourceSubmissionBff(
    createPrivateApiClient({
      baseUrl: requiredEnvironmentValue(environment, "PRIVATE_API_BASE_URL"),
      serviceCredential: requiredEnvironmentValue(environment, "PRIVATE_API_SERVICE_CREDENTIAL"),
    }),
  );
}

function isQueuedResponse(value: unknown): value is { submission: QueuedSourceSubmission } {
  if (!isRecord(value) || !isRecord(value.submission) || Object.keys(value).length !== 1) return false;
  const submission = value.submission;
  return (
    submission.state === "queued" &&
    isNonEmptyString(submission.idempotencyKey) &&
    isNonEmptyString(submission.submissionId) &&
    isIsoDateTime(submission.queuedAt)
  );
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: "PRIVATE_API_BASE_URL" | "PRIVATE_API_SERVICE_CREDENTIAL",
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before submitting source material.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export type SourceSubmissionDraft = Readonly<{
  kind: SourceSubmissionKind;
  originalIdentifier: string;
  rightsNote: string;
}>;
