import { describe, expect, it, vi } from "vitest";

import { createCurrentUpdateWorkflowCommand } from "./current-update-workflow-command";

const transition = {
  currentUpdateId: "11111111-1111-4111-8111-111111111111",
  to: "needs-verification" as const,
  actorId: "google:editor",
  occurredAt: "2026-08-07T00:00:00.000Z",
};

describe("createCurrentUpdateWorkflowCommand", () => {
  it("moves a source-backed dated update through the human workflow", async () => {
    const persist = vi.fn().mockResolvedValue("persisted");
    const command = createCurrentUpdateWorkflowCommand({
      retrieve: vi.fn().mockResolvedValue({ id: transition.currentUpdateId, status: "draft", hasAcceptedSource: true }),
      persist,
    });

    await expect(command.transition(transition)).resolves.toEqual({
      ok: true,
      currentUpdateId: transition.currentUpdateId,
      status: "needs-verification",
    });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ from: "draft", to: "needs-verification" }));
  });

  it("does not allow publication without reviewed evidence", async () => {
    const command = createCurrentUpdateWorkflowCommand({
      retrieve: vi.fn().mockResolvedValue({ id: transition.currentUpdateId, status: "approved", hasAcceptedSource: false }),
      persist: vi.fn(),
    });

    await expect(command.transition({ ...transition, to: "published" })).resolves.toEqual({
      ok: false,
      reason: "publication-requires-accepted-source",
    });
  });
});
