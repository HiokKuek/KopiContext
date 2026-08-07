import { describe, expect, it, vi } from "vitest";

import {
  createHumanRevisionCommand,
  type CreateHumanRevisionPersistenceResult,
  type CurrentBriefingForHumanRevision,
  type HumanRevisionRepository,
} from "./create-human-revision-command";

const content = {
  oneSentenceExplanation: "A short map.", thirtySecondOverview: "The quick version.", fiveMinuteExplanation: "The detailed version.", whyPeopleCare: "It helps people understand.",
  keyTerms: [{ term: "Cabinet", definition: "Senior ministers." }], entities: ["Parliament"], debates: ["How is policy scrutinised?"], singaporeSeaAngle: "It applies in Singapore.", questionsToAsk: ["Who decides?"], mistakesToAvoid: ["Do not confuse roles."],
};

function request() { return { idempotencyKey: "human-revision:government:2", briefingId: "briefing-1", expectedRevisionId: "revision-1", actorId: "google:editor", occurredAt: "2026-08-09T10:00:00.000Z", content, note: "Clarified the opening map." }; }
function repository(overrides: Partial<HumanRevisionRepository> = {}): HumanRevisionRepository {
  return {
    retrieveCurrentBriefing: vi.fn(async (): Promise<CurrentBriefingForHumanRevision> => ({ briefingId: "briefing-1", status: "draft", currentRevisionId: "revision-1" })),
    createHumanRevision: vi.fn(async (): Promise<CreateHumanRevisionPersistenceResult> => ({ kind: "created", revisionId: "revision-2", sequence: 2, creationRecordId: "creation-1" })),
    ...overrides,
  };
}

describe("create human revision command", () => {
  it("creates a Template v1 human revision without any agent provenance", async () => {
    const store = repository();
    await expect(createHumanRevisionCommand(store).create(request())).resolves.toEqual({ ok: true, kind: "created", briefingId: "briefing-1", revisionId: "revision-2", sequence: 2, creationRecordId: "creation-1" });
    expect(store.createHumanRevision).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: "v1", actorId: "google:editor", content, note: "Clarified the opening map." }));
    expect(store.createHumanRevision).not.toHaveBeenCalledWith(expect.objectContaining({ aiProvider: expect.anything() }));
  });

  it("rejects a stale current revision before persistence", async () => {
    const store = repository({ retrieveCurrentBriefing: async () => ({ briefingId: "briefing-1", status: "draft", currentRevisionId: "revision-2" }) });
    await expect(createHumanRevisionCommand(store).create(request())).resolves.toEqual({ ok: false, reason: "revision-conflict" });
    expect(store.createHumanRevision).not.toHaveBeenCalled();
  });

  it("only permits a current Draft and a trusted editor", async () => {
    const nonDraft = repository({ retrieveCurrentBriefing: async () => ({ briefingId: "briefing-1", status: "needs-verification", currentRevisionId: "revision-1" }) });
    await expect(createHumanRevisionCommand(nonDraft).create(request())).resolves.toEqual({ ok: false, reason: "briefing-not-draft" });
    const noEditor = repository();
    await expect(createHumanRevisionCommand(noEditor).create({ ...request(), actorId: "  " })).resolves.toEqual({ ok: false, reason: "revision-requires-editor" });
  });

  it("requires Template v1's structured sections but leaves publication completeness to the workflow", async () => {
    const store = repository();
    await expect(createHumanRevisionCommand(store).create({ ...request(), content: { ...content, entities: [42] } as never })).resolves.toEqual({ ok: false, reason: "invalid-template-content" });
    await expect(createHumanRevisionCommand(store).create({ ...request(), content: { ...content, fiveMinuteExplanation: "" } })).resolves.toMatchObject({ ok: true });
  });

  it("returns the original result for a durable command replay", async () => {
    const store = repository({ createHumanRevision: async () => ({ kind: "idempotent", revisionId: "revision-2", sequence: 2, creationRecordId: "creation-1" }) });
    await expect(createHumanRevisionCommand(store).create(request())).resolves.toMatchObject({ ok: true, kind: "idempotent", revisionId: "revision-2" });
  });
});
