import { describe, expect, it, vi } from "vitest";

import { createCurrentUpdateWithSupport, submitCurrentUpdateTransition } from "./current-update-bff";

const input = {
  briefingId: "11111111-1111-4111-8111-111111111111",
  title: "A recent change",
  body: "A concise explanation of what changed.",
  effectiveAt: "2026-08-07T00:00:00.000Z",
  acceptedSourceId: "22222222-2222-4222-8222-222222222222",
  excerpt: "The supporting words.",
  rationale: "They directly support the update.",
};

describe("createCurrentUpdateWithSupport", () => {
  it("creates a draft then attaches the reviewed Source", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ currentUpdateId: "33333333-3333-4333-8333-333333333333" })
      .mockResolvedValueOnce({ supportId: "44444444-4444-4444-8444-444444444444" });

    await expect(
      createCurrentUpdateWithSupport({ actorId: "google:editor", email: "editor@example.com" }, input, {
        api: { command },
        idempotencyKey: () => "request-key",
      }),
    ).resolves.toEqual({
      kind: "success",
      currentUpdateId: "33333333-3333-4333-8333-333333333333",
      supportId: "44444444-4444-4444-8444-444444444444",
    });
    expect(command).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: `/v1/editorial/briefings/${input.briefingId}/current-updates`,
    }));
    expect(command).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: "/v1/editorial/current-updates/33333333-3333-4333-8333-333333333333/supports",
    }));
  });
});

describe("submitCurrentUpdateTransition", () => {
  it("submits a verified human approval transition", async () => {
    const command = vi.fn().mockResolvedValue({ status: "approved" });
    await expect(
      submitCurrentUpdateTransition(
        { actorId: "google:editor", email: "editor@example.com" },
        "33333333-3333-4333-8333-333333333333",
        "approve",
        "",
        null,
        { api: { command } },
      ),
    ).resolves.toEqual({ kind: "success", status: "approved" });
    expect(command).toHaveBeenCalledWith(expect.objectContaining({
      path: "/v1/editorial/current-updates/33333333-3333-4333-8333-333333333333/transitions",
      body: expect.objectContaining({ to: "approved", actorId: "google:editor" }),
    }));
  });

  it("requires an explicit publication confirmation", async () => {
    await expect(
      submitCurrentUpdateTransition(
        { actorId: "google:editor", email: "editor@example.com" },
        "33333333-3333-4333-8333-333333333333",
        "publish",
        "",
        null,
      ),
    ).resolves.toEqual({ kind: "invalid", message: "Confirm publication before publishing this Current Update." });
  });
});
