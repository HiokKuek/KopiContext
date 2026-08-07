import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerHumanRevisionRoute } from "./human-revision-route";

const briefingId = "123e4567-e89b-12d3-a456-426614174000";
const revisionId = "123e4567-e89b-12d3-a456-426614174001";

const content = {
  oneSentenceExplanation: "A short answer.", thirtySecondOverview: "A quick map.", fiveMinuteExplanation: "A fuller explanation.", whyPeopleCare: "It helps people join a conversation.",
  keyTerms: [{ term: "Term", definition: "A clear definition." }], entities: ["An institution"], debates: ["A useful question"], singaporeSeaAngle: "Singapore context.", questionsToAsk: ["What changed?"], mistakesToAvoid: ["Do not overgeneralise."],
};

describe("human Briefing revision route", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

  function createApp(create = vi.fn().mockResolvedValue({ ok: true, kind: "created", briefingId, revisionId: "123e4567-e89b-12d3-a456-426614174002", sequence: 2, creationRecordId: "123e4567-e89b-12d3-a456-426614174003" })) {
    const app = Fastify(); apps.push(app);
    registerHumanRevisionRoute(app, { humanRevisions: { create }, now: () => new Date("2026-08-07T12:00:00.000Z"), invalid: (message) => Object.assign(new Error(message), { statusCode: 400 }), notFound: () => Object.assign(new Error("not found"), { statusCode: 404 }), conflict: () => Object.assign(new Error("conflict"), { statusCode: 409 }), rejected: () => Object.assign(new Error("rejected"), { statusCode: 422 }) });
    return { app, create };
  }

  it("passes only a bounded structured human revision command to the application seam", async () => {
    const { app, create } = createApp();
    const response = await app.inject({ method: "POST", url: `/v1/editorial/briefings/${briefingId}/revisions`, payload: { idempotencyKey: "human-revision:one", expectedRevisionId: revisionId, actorId: "google:editor", content, note: "Clarified the opening." } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ kind: "created", sequence: 2 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ briefingId, expectedRevisionId: revisionId, actorId: "google:editor", content, occurredAt: "2026-08-07T12:00:00.000Z" }));
  });

  it("rejects an unsupported field before it reaches the command", async () => {
    const { app, create } = createApp();
    const response = await app.inject({ method: "POST", url: `/v1/editorial/briefings/${briefingId}/revisions`, payload: { idempotencyKey: "human-revision:one", expectedRevisionId: revisionId, actorId: "google:editor", content, origin: "agent" } });

    expect(response.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a stale current revision to a conflict", async () => {
    const { app } = createApp(vi.fn().mockResolvedValue({ ok: false, reason: "revision-conflict" }));
    const response = await app.inject({ method: "POST", url: `/v1/editorial/briefings/${briefingId}/revisions`, payload: { idempotencyKey: "human-revision:one", expectedRevisionId: revisionId, actorId: "google:editor", content } });

    expect(response.statusCode).toBe(409);
  });
});
