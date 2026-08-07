import { describe, expect, it, vi } from "vitest";

import { createEditorialReviewBff, loadEditorialBriefingReview, submitEditorialTransition } from "./editorial-review-bff";

const editor = { actorId: "google:113355779900", email: "editor@example.com" } as const;

describe("editorial review BFF", () => {
  it("loads detail through the authenticated private query seam", async () => {
    const query = vi.fn().mockResolvedValue(review());
    const state = await loadEditorialBriefingReview(editor, "briefing-1", { transport: createEditorialReviewBff({ query, command: vi.fn() }) });
    expect(state).toMatchObject({ kind: "available", review: { briefing: { id: "briefing-1" } } });
    expect(query).toHaveBeenCalledWith({ path: "/v1/editorial/briefings/briefing-1" });
  });

  it("derives the private command actor from the authenticated identity, never a browser field", async () => {
    const command = vi.fn().mockResolvedValue({ status: "approved" });
    const result = await submitEditorialTransition(editor, "briefing-1", "approve", "Looks ready", undefined, {
      transport: createEditorialReviewBff({ query: vi.fn(), command }),
    });
    expect(result).toEqual({ kind: "success", status: "approved" });
    expect(command).toHaveBeenCalledWith({
      path: "/v1/editorial/briefings/briefing-1/transitions",
      method: "POST",
      body: { to: "approved", actorId: "google:113355779900", reason: "Looks ready" },
    });
  });

  it("requires deliberate publication confirmation and required reasons before private mutation", async () => {
    const transition = vi.fn();
    const transport = { getBriefing: vi.fn(), transition };
    await expect(submitEditorialTransition(editor, "briefing-1", "publish", undefined, undefined, { transport })).resolves.toMatchObject({ kind: "invalid" });
    await expect(submitEditorialTransition(editor, "briefing-1", "archive", "", undefined, { transport })).resolves.toMatchObject({ kind: "invalid" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("keeps missing, malformed, and unavailable details truthful", async () => {
    await expect(loadEditorialBriefingReview(editor, "", { transport: { getBriefing: vi.fn(), transition: vi.fn() } })).resolves.toEqual({ kind: "not-found" });
    await expect(loadEditorialBriefingReview(editor, "briefing-1", { transport: { getBriefing: vi.fn().mockResolvedValue(undefined), transition: vi.fn() } })).resolves.toEqual({ kind: "not-found" });
    await expect(loadEditorialBriefingReview(editor, "briefing-1", { transport: { getBriefing: vi.fn().mockRejectedValue(new Error("private detail")), transition: vi.fn() } })).resolves.toEqual({ kind: "unavailable" });
  });
});

function review() {
  return {
    briefing: { id: "briefing-1", title: "How Singapore's Government Works", topic: { id: "topic-1", slug: "government", title: "Government" }, status: "in-editorial-review" },
    revision: { id: "revision-1", sequence: 1, templateVersion: "v1", content: {}, origin: "human", createdBy: "google:1", createdAt: "2026-01-01T00:00:00.000Z" },
    templateSections: [], claims: [], acceptedSources: [],
    freshness: { lastActivityAt: "2026-01-01T00:00:00.000Z", reviewAgeDays: 0, isStale: false },
    auditRecords: [], allowedActions: ["approve"],
  };
}
