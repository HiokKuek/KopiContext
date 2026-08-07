import { describe, expect, it, vi } from "vitest";

import {
  createEditorialWorkspaceBff,
  loadEditorWorkspaceQueue,
} from "./editor-workspace-bff";

const editor = { actorId: "google:113355779900", email: "editor@example.com" } as const;

describe("editor workspace BFF", () => {
  it("uses the private server query seam and validates its queue contract", async () => {
    const query = vi.fn().mockResolvedValue(queue());
    const transport = createEditorialWorkspaceBff({ query });

    await expect(transport.listReviewQueue(editor)).resolves.toEqual(queue());
    expect(query).toHaveBeenCalledWith({ path: "/v1/editorial/work" });
  });

  it("does not turn a failed or malformed private response into an empty queue", async () => {
    await expect(
      loadEditorWorkspaceQueue(editor, {
        transport: { listReviewQueue: vi.fn().mockRejectedValue(new Error("credential rejected")) },
      }),
    ).resolves.toEqual({ kind: "unavailable" });

    await expect(
      loadEditorWorkspaceQueue(editor, {
        transport: createEditorialWorkspaceBff({ query: vi.fn().mockResolvedValue({ items: [] }) }),
      }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("passes an available queue through without browser or credential data", async () => {
    await expect(
      loadEditorWorkspaceQueue(editor, { transport: { listReviewQueue: vi.fn().mockResolvedValue(queue()) } }),
    ).resolves.toEqual({ kind: "available", queue: queue() });
  });
});

function queue() {
  return {
    countsByStatus: {
      draft: 1,
      "needs-verification": 0,
      "in-editorial-review": 0,
      approved: 0,
      published: 0,
      archived: 0,
    },
    items: [
      {
        briefingId: "briefing-1",
        title: "How Singapore's Government Works",
        topicTitle: "Singapore government",
        status: "draft",
        revisionId: "revision-1",
        revisionCreatedAt: "2026-08-07T00:00:00.000Z",
        freshness: { lastActivityAt: "2026-08-07T00:00:00.000Z", reviewAgeDays: 0, isStale: false },
        completeness: {
          isComplete: false,
          missingSectionCount: 2,
          claimCount: 4,
          unsupportedClaimCount: 1,
          acceptedSourceCount: 3,
        },
      },
    ],
  };
}
