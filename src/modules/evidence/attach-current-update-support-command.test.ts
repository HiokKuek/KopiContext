import { describe, expect, it, vi } from "vitest";

import { attachCurrentUpdateSupportCommand } from "./attach-current-update-support-command";

const request = {
  idempotencyKey: "current-update-support:1",
  currentUpdateId: "11111111-1111-4111-8111-111111111111",
  acceptedSourceId: "22222222-2222-4222-8222-222222222222",
  excerpt: "The relevant supporting passage.",
  rationale: "It directly supports this dated update.",
  actorId: "google:editor",
  occurredAt: "2026-08-07T00:00:00.000Z",
};

describe("attachCurrentUpdateSupportCommand", () => {
  it("attaches evidence to a draft update without changing its workflow state", async () => {
    const attach = vi.fn().mockResolvedValue({ kind: "created", supportId: "support-1" });

    await expect(attachCurrentUpdateSupportCommand({ attach }).attach(request)).resolves.toEqual({
      ok: true,
      kind: "created",
      supportId: "support-1",
    });
  });

  it("rejects malformed support before persistence", async () => {
    const attach = vi.fn();

    await expect(
      attachCurrentUpdateSupportCommand({ attach }).attach({ ...request, excerpt: " " }),
    ).resolves.toEqual({ ok: false, reason: "invalid-support" });
    expect(attach).not.toHaveBeenCalled();
  });
});
