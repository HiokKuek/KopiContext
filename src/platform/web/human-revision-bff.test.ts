import { describe, expect, it, vi } from "vitest";

import { createHumanRevision, createHumanRevisionBff } from "./human-revision-bff";

const editor = { actorId: "google:editor", email: "editor@example.test", name: "Editor" };
const input = { briefingId: "123e4567-e89b-12d3-a456-426614174000", expectedRevisionId: "123e4567-e89b-12d3-a456-426614174001", content: { oneSentenceExplanation: "One.", thirtySecondOverview: "Two.", fiveMinuteExplanation: "Three.", whyPeopleCare: "Four.", keyTerms: [], entities: [], debates: [], singaporeSeaAngle: "Five.", questionsToAsk: [], mistakesToAvoid: [] } };

describe("human revision BFF", () => {
  it("derives the actor from the authenticated editor and returns the saved revision", async () => {
    const create = vi.fn().mockResolvedValue({ revisionId: "123e4567-e89b-12d3-a456-426614174002", sequence: 2 });
    await expect(createHumanRevision(editor, input, { transport: { create }, idempotencyKey: () => "human-revision:test" })).resolves.toEqual({ kind: "success", revisionId: "123e4567-e89b-12d3-a456-426614174002", sequence: 2 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actorId: editor.actorId, idempotencyKey: "human-revision:test" }));
  });

  it("keeps the browser-facing transport from sending a caller-selected briefing ID in its path body", async () => {
    const command = vi.fn().mockResolvedValue({ revisionId: "123e4567-e89b-12d3-a456-426614174002", sequence: 2 });
    await createHumanRevisionBff({ command }).create({ ...input, actorId: editor.actorId, idempotencyKey: "human-revision:test" });
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ path: `/v1/editorial/briefings/${input.briefingId}/revisions`, body: expect.not.objectContaining({ briefingId: expect.anything() }) }));
  });
});
