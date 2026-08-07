import "server-only";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { SourceSubmissionReview } from "@/modules/preparation/source-submission-read-model";
import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type SourceSubmissionReviewTransport = Readonly<{ getSourceSubmission(editor: EditorIdentity, submissionId: string): Promise<SourceSubmissionReview | undefined> }>;
export type SourceSubmissionReviewState = Readonly<{ kind: "available"; submission: SourceSubmissionReview }> | Readonly<{ kind: "not-found" }> | Readonly<{ kind: "unavailable" }>;

/** Authenticated server-only query for a minimised preparation review. */
export function createSourceSubmissionReviewBff(privateApi: Pick<PrivateApiClient, "query">): SourceSubmissionReviewTransport {
  return { async getSourceSubmission(_editor, submissionId) {
    const response = await privateApi.query<unknown>({ path: `/v1/editorial/source-submissions/${encodeURIComponent(submissionId)}` });
    if (!isReview(response)) throw new Error("The private API returned an invalid Source Submission review.");
    return response;
  } };
}

export async function loadSourceSubmissionReview(editor: EditorIdentity, submissionId: string, dependencies: Readonly<{ transport?: SourceSubmissionReviewTransport; environment?: Readonly<Record<string, string | undefined>> }> = {}): Promise<SourceSubmissionReviewState> {
  if (!isIdentifier(submissionId)) return { kind: "not-found" };
  try {
    const transport = dependencies.transport ?? createSourceSubmissionReviewBffFromEnvironment(dependencies.environment);
    const submission = await transport.getSourceSubmission(editor, submissionId);
    return submission ? { kind: "available", submission } : { kind: "not-found" };
  } catch (error) {
    return error instanceof PrivateApiClientError && error.code === "not_found" ? { kind: "not-found" } : { kind: "unavailable" };
  }
}

export function createSourceSubmissionReviewBffFromEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): SourceSubmissionReviewTransport {
  const baseUrl = environment.PRIVATE_API_BASE_URL?.trim();
  const serviceCredential = environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim();
  if (!baseUrl || !serviceCredential) throw new Error("Private API configuration is required before loading a Source Submission review.");
  return createSourceSubmissionReviewBff(createPrivateApiClient({ baseUrl, serviceCredential }));
}

function isReview(value: unknown): value is SourceSubmissionReview {
  if (!record(value)) return false;
  const required = ["id", "kind", "originalIdentifier", "submittedBy", "submittedAt", "rightsNote", "processingStatus"];
  if (!required.every((key) => typeof value[key] === "string")) return false;
  return value.proposal === undefined || proposal(value.proposal);
}
function proposal(value: unknown): boolean {
  if (!record(value) || !record(value.draft) || !Array.isArray(value.candidateClaims)) return false;
  return typeof value.proposedTopic === "string" && typeof value.confidence === "number" && typeof value.rationale === "string" && typeof value.draft.templateVersion === "string" && typeof value.draft.title === "string" && Array.isArray(value.draft.sections) && value.candidateClaims.every((claim) => record(claim) && typeof claim.statement === "string" && typeof claim.excerpt === "string" && typeof claim.confidence === "number" && typeof claim.rationale === "string") && value.draft.sections.every((section) => record(section) && typeof section.section === "string" && typeof section.body === "string");
}
function isIdentifier(value: string): boolean { return value.trim().length > 0 && value.length <= 200; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
