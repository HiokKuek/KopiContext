import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorialClaimCommand } from "@/modules/evidence/create-editorial-claim-command";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const auth: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test" ? { kind: "private-service" } : null;
  },
};
const catalogue: PublicCatalogueQuery = { findPublishedBriefingBySlug: () => undefined };
const briefingId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const body = {
  idempotencyKey: "editorial-claim:government:executive",
  briefingRevisionId: revisionId,
  acceptedSourceId: sourceId,
  actorId: "google:editor",
  claim: {
    statement: "The Executive implements policy.",
    excerpt: "The Executive implements government policy.",
    rationale: "The passage directly states the relationship.",
  },
};

describe("editorial Claim private route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function app(command: ReturnType<typeof createEditorialClaimCommand>) {
    const instance = buildPrivateApi({
      serviceAuthenticator: auth,
      publicCatalogue: catalogue,
      editorialClaims: command,
      now: () => new Date("2026-08-08T12:00:00.000Z"),
    });
    apps.push(instance);
    return instance;
  }

  it("uses the server timestamp and returns the durable Claim receipt", async () => {
    const create = vi.fn().mockResolvedValue({
      kind: "created",
      claimId: "44444444-4444-4444-8444-444444444444",
      claimSupportId: "55555555-5555-4555-8555-555555555555",
      recordId: "66666666-6666-4666-8666-666666666666",
    });
    const response = await app(createEditorialClaimCommand({ create })).inject({
      method: "POST",
      url: `/v1/editorial/briefings/${briefingId}/claims`,
      headers: { authorization: "Bearer test" },
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      briefingId,
      occurredAt: "2026-08-08T12:00:00.000Z",
    }));
    expect(response.json()).toEqual({
      kind: "created",
      claimId: "44444444-4444-4444-8444-444444444444",
      claimSupportId: "55555555-5555-4555-8555-555555555555",
      recordId: "66666666-6666-4666-8666-666666666666",
    });
  });

  it("requires private service authentication and rejects browser-only fields", async () => {
    const command = createEditorialClaimCommand({ create: vi.fn() });

    expect((await app(command).inject({ method: "POST", url: `/v1/editorial/briefings/${briefingId}/claims`, payload: body })).statusCode).toBe(401);
    expect((await app(command).inject({ method: "POST", url: `/v1/editorial/briefings/${briefingId}/claims`, headers: { authorization: "Bearer test" }, payload: { ...body, occurredAt: "browser" } })).statusCode).toBe(400);
  });
});
