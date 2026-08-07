import "server-only";

import { randomUUID } from "node:crypto";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { CandidateClaimAcceptanceContext } from "@/modules/evidence/candidate-claim-acceptance-context";
import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type CandidateClaimAcceptanceContextState =
  | Readonly<{ kind: "available"; context: CandidateClaimAcceptanceContext }>
  | Readonly<{ kind: "not-found" | "unavailable" }>;

export type CandidateClaimAcceptanceResult =
  | Readonly<{ kind: "success"; claimId: string; claimSupportId: string }>
  | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;

export type CandidateClaimAcceptanceTransport = Readonly<{
  getContext(submissionId: string): Promise<CandidateClaimAcceptanceContext>;
  accept(input: Readonly<{
    submissionId: string;
    actorId: string;
    idempotencyKey: string;
    expectedOutputFingerprint: string;
    candidateIndex: number;
    briefingRevisionId: string;
    acceptedSourceId: string;
  }>): Promise<Readonly<{ claimId: string; claimSupportId: string }>>;
}>;

export function createCandidateClaimAcceptanceBff(privateApi: Pick<PrivateApiClient, "query" | "command">): CandidateClaimAcceptanceTransport {
  return {
    async getContext(submissionId) {
      const response = await privateApi.query<unknown>({ path: `/v1/editorial/source-submissions/${encodeURIComponent(submissionId)}/candidate-claim-context` });
      if (!isContext(response)) throw new Error("The private API returned an invalid candidate Claim context.");
      return response;
    },
    async accept(input) {
      const response = await privateApi.command<unknown>({
        path: `/v1/editorial/source-submissions/${encodeURIComponent(input.submissionId)}/candidate-claims/acceptance`,
        method: "POST",
        body: input,
      });
      if (!record(response) || !text(response.claimId) || !text(response.claimSupportId)) {
        throw new Error("The private API returned an invalid candidate Claim acceptance response.");
      }
      return { claimId: response.claimId, claimSupportId: response.claimSupportId };
    },
  };
}

export async function loadCandidateClaimAcceptanceContext(
  _editor: EditorIdentity,
  submissionId: string,
  dependencies: Readonly<{ transport?: CandidateClaimAcceptanceTransport; environment?: Readonly<Record<string, string | undefined>> }> = {},
): Promise<CandidateClaimAcceptanceContextState> {
  if (!identifier(submissionId)) return { kind: "not-found" };
  try {
    const context = await (dependencies.transport ?? fromEnvironment(dependencies.environment)).getContext(submissionId);
    return { kind: "available", context };
  } catch (error) {
    return error instanceof PrivateApiClientError && error.code === "not_found" ? { kind: "not-found" } : { kind: "unavailable" };
  }
}

export async function acceptCandidateClaim(
  editor: EditorIdentity,
  input: Readonly<{
    submissionId: string;
    expectedOutputFingerprint: string;
    candidateIndex: number;
    briefingRevisionId: unknown;
    acceptedSourceId: unknown;
    confirmed: unknown;
  }>,
  dependencies: Readonly<{ transport?: CandidateClaimAcceptanceTransport; environment?: Readonly<Record<string, string | undefined>>; idempotencyKey?: () => string }> = {},
): Promise<CandidateClaimAcceptanceResult> {
  if (input.confirmed !== "accept-candidate-claim") {
    return { kind: "invalid", message: "Confirm that you have reviewed this candidate Claim before accepting it." };
  }
  if (!identifier(input.submissionId) || !fingerprint(input.expectedOutputFingerprint) || !Number.isInteger(input.candidateIndex) || input.candidateIndex < 0 || !uuid(input.briefingRevisionId) || !uuid(input.acceptedSourceId)) {
    return { kind: "invalid", message: "Choose a valid Draft revision and Accepted Source before accepting this candidate Claim." };
  }
  try {
    const accepted = await (dependencies.transport ?? fromEnvironment(dependencies.environment)).accept({
      submissionId: input.submissionId,
      actorId: editor.actorId,
      idempotencyKey: (dependencies.idempotencyKey ?? randomUUID)(),
      expectedOutputFingerprint: input.expectedOutputFingerprint,
      candidateIndex: input.candidateIndex,
      briefingRevisionId: input.briefingRevisionId,
      acceptedSourceId: input.acceptedSourceId,
    });
    return { kind: "success", claimId: accepted.claimId, claimSupportId: accepted.claimSupportId };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["not_found", "conflict", "validation_failed", "bad_request"].includes(error.code)) {
      return { kind: "rejected", message: "This candidate Claim was not accepted. Reload the proposal and review the current editorial records." };
    }
    return { kind: "unavailable", message: "The editorial service is unavailable. No candidate Claim was accepted; try again shortly." };
  }
}

function fromEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): CandidateClaimAcceptanceTransport {
  const baseUrl = environment.PRIVATE_API_BASE_URL?.trim();
  const serviceCredential = environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim();
  if (!baseUrl || !serviceCredential) throw new Error("Private API configuration is required before accepting a candidate Claim.");
  return createCandidateClaimAcceptanceBff(createPrivateApiClient({ baseUrl, serviceCredential }));
}

function isContext(value: unknown): value is CandidateClaimAcceptanceContext {
  if (!record(value) || !record(value.submission) || !record(value.proposal) || !Array.isArray(value.revisionsCreatedFromSubmission) || !Array.isArray(value.sourcesAcceptedFromSubmission)) return false;
  return text(value.submission.id) !== undefined && text(value.proposal.outputFingerprint) !== undefined && Array.isArray(value.proposal.candidateClaims)
    && value.proposal.candidateClaims.every((claim) => record(claim) && Number.isInteger(claim.index) && text(claim.statement) !== undefined && text(claim.excerpt) !== undefined && typeof claim.confidence === "number" && text(claim.rationale) !== undefined)
    && value.revisionsCreatedFromSubmission.every((revision) => record(revision) && text(revision.id) !== undefined && text(revision.briefingId) !== undefined && record(revision.topic) && text(revision.topic.title) !== undefined && text(revision.topic.slug) !== undefined && Number.isInteger(revision.sequence) && text(revision.draftTitle) !== undefined && text(revision.templateVersion) !== undefined && text(revision.createdAt) !== undefined)
    && value.sourcesAcceptedFromSubmission.every((source) => record(source) && text(source.id) !== undefined && text(source.title) !== undefined && text(source.publisher) !== undefined && text(source.sourceType) !== undefined && text(source.canonicalUrl) !== undefined && text(source.retrievedAt) !== undefined && text(source.rightsNote) !== undefined && text(source.acceptedAt) !== undefined);
}
function identifier(value: string): boolean { return value.trim().length > 0 && value.length <= 200; }
function fingerprint(value: string): boolean { return /^sha256:[a-f0-9]{64}$/.test(value); }
function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
