import { describe, expect, it, vi } from "vitest";
import { createEditorialDraftCommand } from "./create-editorial-draft-command";

const content = {
  oneSentenceExplanation: "A clear explanation.", thirtySecondOverview: "A short overview.", fiveMinuteExplanation: "A longer explanation.", whyPeopleCare: "It matters.", keyTerms: [], entities: [], debates: [], singaporeSeaAngle: "Singapore context.", questionsToAsk: [], mistakesToAvoid: [],
};

describe("create editorial Draft", () => {
  it("creates only a human-origin Draft through the persistence seam", async () => {
    const createDraft = vi.fn().mockResolvedValue({ kind: "created", topicId: "topic", briefingId: "briefing", revisionId: "revision", creationRecordId: "record" });
    const command = createEditorialDraftCommand({ createDraft });
    await expect(command.create({ idempotencyKey: "create-draft:123", actorId: "google:1", occurredAt: "2026-08-10T00:00:00.000Z", topic: { slug: "how-government-works", title: "How government works", description: "A civic explanation." }, content })).resolves.toEqual({ ok: true, kind: "created", topicId: "topic", briefingId: "briefing", revisionId: "revision", creationRecordId: "record" });
    expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({ status: "draft", revision: expect.objectContaining({ origin: "human", templateVersion: "v1", createdBy: "google:1" }) }));
  });

  it("refuses malformed taxonomy and template content before persistence", async () => {
    const createDraft = vi.fn();
    const command = createEditorialDraftCommand({ createDraft });
    await expect(command.create({ idempotencyKey: "short", actorId: "", occurredAt: "invalid", topic: { slug: "Bad slug", title: "", description: "" }, content: {} as typeof content })).resolves.toEqual({ ok: false, reason: "invalid-draft" });
    expect(createDraft).not.toHaveBeenCalled();
  });
});
