import { describe, expect, it, vi } from "vitest";

import { createEditorialClaim } from "./editorial-claim-bff";

const editor = { actorId: "google:editor", email: "editor@example.com" };
const input = {
  briefingId: "11111111-1111-4111-8111-111111111111",
  briefingRevisionId: "22222222-2222-4222-8222-222222222222",
  acceptedSourceId: "33333333-3333-4333-8333-333333333333",
  claim: { statement: "A statement.", excerpt: "A supporting excerpt.", rationale: "Direct support." },
};

describe("createEditorialClaim", () => {
  it("keeps the private credential server-side and sends the signed-in editor as actor", async () => {
    const command = vi.fn().mockResolvedValue({
      claimId: "44444444-4444-4444-8444-444444444444",
      claimSupportId: "55555555-5555-4555-8555-555555555555",
    });

    await expect(createEditorialClaim(editor, input, { api: { command }, idempotencyKey: () => "editorial-claim:1" })).resolves.toMatchObject({ kind: "success" });
    expect(command).toHaveBeenCalledWith(expect.objectContaining({
      path: `/v1/editorial/briefings/${input.briefingId}/claims`,
      body: expect.objectContaining({ actorId: editor.actorId, idempotencyKey: "editorial-claim:1" }),
    }));
  });

  it("does not call the private API for incomplete evidence", async () => {
    const command = vi.fn();

    await expect(createEditorialClaim(editor, { ...input, claim: { ...input.claim, excerpt: "" } }, { api: { command } })).resolves.toMatchObject({ kind: "invalid" });
    expect(command).not.toHaveBeenCalled();
  });
});
