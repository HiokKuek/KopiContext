import { afterEach, describe, expect, it, vi } from "vitest";

import type { AcceptPreparedProposalCommand } from "@/modules/editorial/accept-prepared-proposal-command";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test-credential" ? { kind: "private-service" } : null;
  },
};

const publicCatalogue: PublicCatalogueQuery = { findPublishedBriefingBySlug: () => undefined };
const submissionId = "123e4567-e89b-12d3-a456-426614174000";
const payload = {
  idempotencyKey: "proposal-acceptance:government:v1",
  actorId: "google:editor-opaque-id",
  expectedOutputFingerprint: "sha256:8bb0d4d4b9e657a7281c8026bd2ac6200277f426f8a4cf7cab4349e43d8b01a7",
  topic: {
    slug: "how-singapores-government-works",
    description: "An introduction to Singapore's system of government.",
  },
};

describe("prepared-proposal acceptance private API route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(command: AcceptPreparedProposalCommand) {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      preparedProposalAcceptances: command,
      now: () => new Date("2026-08-08T10:00:00.000Z"),
    });
    apps.push(app);
    return app;
  }

  it("passes only a strict, server-timestamped acceptance from the trusted BFF to the command", async () => {
    const accept = vi.fn().mockResolvedValue({
      ok: true,
      kind: "created",
      topicId: "topic-government",
      briefingId: "briefing-government",
      revisionId: "revision-government-1",
      decisionId: "decision-government",
    });
    const response = await createApp({ accept }).inject({
      method: "POST",
      url: `/v1/editorial/source-submissions/${submissionId}/acceptance`,
      headers: { authorization: "Bearer test-credential" },
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(accept).toHaveBeenCalledWith({
      ...payload,
      submissionId,
      occurredAt: "2026-08-08T10:00:00.000Z",
    });
    expect(response.json()).toEqual({
      kind: "created",
      topicId: "topic-government",
      briefingId: "briefing-government",
      revisionId: "revision-government-1",
      decisionId: "decision-government",
    });
  });

  it("returns a stable idempotent acknowledgement without creating a second command", async () => {
    const response = await createApp({
      accept: async () => ({
        ok: true,
        kind: "idempotent",
        topicId: "topic-government",
        briefingId: "briefing-government",
        revisionId: "revision-government-1",
        decisionId: "decision-government",
      }),
    }).inject({
      method: "POST",
      url: `/v1/editorial/source-submissions/${submissionId}/acceptance`,
      headers: { authorization: "Bearer test-credential" },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ kind: "idempotent", decisionId: "decision-government" });
  });

  it("requires private service authentication before accepting a proposal", async () => {
    const accept = vi.fn();
    const response = await createApp({ accept }).inject({
      method: "POST",
      url: `/v1/editorial/source-submissions/${submissionId}/acceptance`,
      payload,
    });

    expect(response.statusCode).toBe(401);
    expect(accept).not.toHaveBeenCalled();
  });

  it("rejects client-controlled timestamps and unsupported fields before the command", async () => {
    const accept = vi.fn();
    const response = await createApp({ accept }).inject({
      method: "POST",
      url: `/v1/editorial/source-submissions/${submissionId}/acceptance`,
      headers: { authorization: "Bearer test-credential" },
      payload: { ...payload, occurredAt: "client-controlled" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "invalid_request", message: "Request body contains an unsupported field." },
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it("maps stale or idempotency conflicts to one stable conflict response", async () => {
    const response = await createApp({
      accept: async () => ({ ok: false, reason: "proposal-conflict" }),
    }).inject({
      method: "POST",
      url: `/v1/editorial/source-submissions/${submissionId}/acceptance`,
      headers: { authorization: "Bearer test-credential" },
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "conflict",
        message: "The proposal changed or this acceptance conflicts with existing editorial work.",
      },
    });
  });
});
