import { afterEach, describe, expect, it, vi } from "vitest";

import type { AcceptSourceFromSubmissionCommand } from "@/modules/evidence/accept-source-from-submission-command";
import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const auth: ServiceCredentialAuthenticator = { async authenticate(value) { return value === "Bearer test" ? { kind: "private-service" } : null; } };
const catalogue: PublicCatalogueQuery = { findPublishedBriefingBySlug: () => undefined };
const id = "123e4567-e89b-12d3-a456-426614174000";
const body = {
  idempotencyKey: "source-acceptance:government:v1",
  actorId: "google:editor",
  expectedOutputFingerprint: "sha256:8bb0d4d4b9e657a7281c8026bd2ac6200277f426f8a4cf7cab4349e43d8b01a7",
  source: { title: "Constitution", publisher: "Singapore Statutes Online", sourceType: "legal", canonicalUrl: "https://sso.agc.gov.sg/Constitution/Constitution", retrievedAt: "2026-08-08T10:00:00.000Z", relation: "Primary legal context.", rightsNote: "Public legal material." },
};

describe("Source acceptance private API route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
  function app(command: AcceptSourceFromSubmissionCommand) {
    const instance = buildPrivateApi({ serviceAuthenticator: auth, publicCatalogue: catalogue, sourceAcceptances: command, now: () => new Date("2026-08-08T11:00:00.000Z") });
    apps.push(instance); return instance;
  }
  it("passes strict BFF-originated acceptance with a server timestamp", async () => {
    const accept = vi.fn().mockResolvedValue({ ok: true, kind: "created", acceptedSourceId: "source-1", decisionId: "decision-1" });
    const response = await app({ accept }).inject({ method: "POST", url: `/v1/editorial/source-submissions/${id}/sources`, headers: { authorization: "Bearer test" }, payload: body });
    expect(response.statusCode).toBe(201);
    expect(accept).toHaveBeenCalledWith({ ...body, submissionId: id, occurredAt: "2026-08-08T11:00:00.000Z" });
    expect(response.json()).toEqual({ kind: "created", acceptedSourceId: "source-1", decisionId: "decision-1" });
  });
  it("returns an idempotent acknowledgement", async () => {
    const response = await app({ accept: async () => ({ ok: true, kind: "idempotent", acceptedSourceId: "source-1", decisionId: "decision-1" }) }).inject({ method: "POST", url: `/v1/editorial/source-submissions/${id}/sources`, headers: { authorization: "Bearer test" }, payload: body });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ kind: "idempotent" });
  });
  it("requires service authentication and rejects unsupported client fields", async () => {
    const accept = vi.fn();
    const unauthenticated = await app({ accept }).inject({ method: "POST", url: `/v1/editorial/source-submissions/${id}/sources`, payload: body });
    expect(unauthenticated.statusCode).toBe(401);
    const invalid = await app({ accept }).inject({ method: "POST", url: `/v1/editorial/source-submissions/${id}/sources`, headers: { authorization: "Bearer test" }, payload: { ...body, occurredAt: "browser" } });
    expect(invalid.statusCode).toBe(400); expect(accept).not.toHaveBeenCalled();
  });
  it("maps stale output to the stable conflict envelope", async () => {
    const response = await app({ accept: async () => ({ ok: false, reason: "proposal-conflict" }) }).inject({ method: "POST", url: `/v1/editorial/source-submissions/${id}/sources`, headers: { authorization: "Bearer test" }, payload: body });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "conflict", message: "The proposal changed or this Source acceptance conflicts with existing evidence." } });
  });
});
