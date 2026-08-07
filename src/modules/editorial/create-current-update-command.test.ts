import { describe, expect, it, vi } from "vitest";
import { createCurrentUpdateCommand } from "./create-current-update-command";

const request = { idempotencyKey: "current-update:1", briefingId: "11111111-1111-4111-8111-111111111111", actorId: "google:editor", occurredAt: "2026-08-07T00:00:00.000Z", effectiveAt: "2026-08-06T00:00:00.000Z", title: "A dated change", body: "A concise explanation." };

describe("createCurrentUpdateCommand", () => {
  it("creates a private Draft without accepting evidence or publishing", async () => {
    const createDraft = vi.fn().mockResolvedValue({ kind: "created", currentUpdateId: "update-1" });
    await expect(createCurrentUpdateCommand({ createDraft }).create(request)).resolves.toEqual({ ok: true, kind: "created", currentUpdateId: "update-1" });
    expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "A dated change" }));
  });
  it("rejects malformed updates before persistence", async () => {
    const createDraft = vi.fn();
    await expect(createCurrentUpdateCommand({ createDraft }).create({ ...request, effectiveAt: "not-a-date" })).resolves.toEqual({ ok: false, reason: "invalid-update" });
    expect(createDraft).not.toHaveBeenCalled();
  });
});
