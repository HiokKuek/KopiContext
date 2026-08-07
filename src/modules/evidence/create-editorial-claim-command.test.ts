import { describe, expect, it, vi } from "vitest";

import { createEditorialClaimCommand } from "./create-editorial-claim-command";

const request = {
  idempotencyKey: "editorial-claim:1",
  briefingId: "11111111-1111-4111-8111-111111111111",
  briefingRevisionId: "22222222-2222-4222-8222-222222222222",
  acceptedSourceId: "33333333-3333-4333-8333-333333333333",
  actorId: "google:editor",
  occurredAt: "2026-08-07T10:00:00.000Z",
  claim: {
    statement: "Parliament debates Bills.",
    excerpt: "Bills are debated in Parliament.",
    rationale: "The excerpt directly supports the statement.",
  },
};

describe("createEditorialClaimCommand", () => {
  it("persists one trimmed, explicitly supported Claim", async () => {
    const create = vi.fn().mockResolvedValue({
      kind: "created",
      claimId: "claim-1",
      claimSupportId: "support-1",
      recordId: "record-1",
    });
    const command = createEditorialClaimCommand({ create });

    await expect(command.create({ ...request, claim: { ...request.claim, statement: " Parliament debates Bills. " } })).resolves.toMatchObject({
      ok: true,
      claimId: "claim-1",
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ claim: expect.objectContaining({ statement: "Parliament debates Bills." }) }));
  });

  it("rejects a Claim without an excerpt before persistence", async () => {
    const create = vi.fn();
    const command = createEditorialClaimCommand({ create });

    await expect(command.create({ ...request, claim: { ...request.claim, excerpt: " " } })).resolves.toEqual({ ok: false, reason: "invalid-request" });
    expect(create).not.toHaveBeenCalled();
  });
});
