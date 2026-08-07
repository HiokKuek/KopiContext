import { describe, expect, it, vi } from "vitest";

import { PrivateApiClientError } from "./private-api-client";
import { acceptCandidateClaim, createCandidateClaimAcceptanceBff, loadCandidateClaimAcceptanceContext } from "./candidate-claim-acceptance-bff";

const editor = { actorId: "google:113355779900", email: "editor@example.com" };
const id = "123e4567-e89b-42d3-a456-426614174000";
const revisionId = "223e4567-e89b-42d3-a456-426614174000";
const sourceId = "323e4567-e89b-42d3-a456-426614174000";
const fingerprint = `sha256:${"a".repeat(64)}`;

describe("candidate Claim acceptance BFF", () => {
  it("uses the trusted actor, reviewed fingerprint, and generated idempotency key", async () => {
    const command = vi.fn().mockResolvedValue({ claimId: "claim-1", claimSupportId: "support-1" });
    await expect(acceptCandidateClaim(editor, { submissionId: id, expectedOutputFingerprint: fingerprint, candidateIndex: 0, briefingRevisionId: revisionId, acceptedSourceId: sourceId, confirmed: "accept-candidate-claim" }, { transport: createCandidateClaimAcceptanceBff({ query: vi.fn(), command }), idempotencyKey: () => "claim:accept:1" })).resolves.toEqual({ kind: "success", claimId: "claim-1", claimSupportId: "support-1" });
    expect(command).toHaveBeenCalledWith({ path: `/v1/editorial/source-submissions/${id}/candidate-claims/acceptance`, method: "POST", body: { submissionId: id, actorId: editor.actorId, idempotencyKey: "claim:accept:1", expectedOutputFingerprint: fingerprint, candidateIndex: 0, briefingRevisionId: revisionId, acceptedSourceId: sourceId } });
  });

  it("rejects missing confirmation and invalid selected IDs before mutation", async () => {
    const accept = vi.fn();
    await expect(acceptCandidateClaim(editor, { submissionId: id, expectedOutputFingerprint: fingerprint, candidateIndex: 0, briefingRevisionId: "nope", acceptedSourceId: sourceId, confirmed: undefined }, { transport: { getContext: vi.fn(), accept } })).resolves.toMatchObject({ kind: "invalid" });
    expect(accept).not.toHaveBeenCalled();
  });

  it("maps private conflicts to a safe rejected result", async () => {
    await expect(acceptCandidateClaim(editor, { submissionId: id, expectedOutputFingerprint: fingerprint, candidateIndex: 0, briefingRevisionId: revisionId, acceptedSourceId: sourceId, confirmed: "accept-candidate-claim" }, { transport: { getContext: vi.fn(), accept: vi.fn().mockRejectedValue(new PrivateApiClientError("conflict", "stale")) } })).resolves.toMatchObject({ kind: "rejected" });
  });

  it("treats an invalid context response as unavailable", async () => {
    await expect(loadCandidateClaimAcceptanceContext(editor, id, { transport: createCandidateClaimAcceptanceBff({ query: vi.fn().mockResolvedValue({ proposal: {} }), command: vi.fn() }) })).resolves.toEqual({ kind: "unavailable" });
  });
});
