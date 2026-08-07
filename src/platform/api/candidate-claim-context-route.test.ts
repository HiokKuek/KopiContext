import { afterEach, describe, expect, it } from "vitest";

import type { CandidateClaimAcceptanceContextQuery } from "@/modules/evidence/candidate-claim-acceptance-context";

import { buildPrivateApi } from "./app";

const query: CandidateClaimAcceptanceContextQuery = {
  async getCandidateClaimAcceptanceContext(id) {
    if (id === "missing") return { kind: "not-found" };
    if (id === "not-ready") return { kind: "proposal-unavailable" };
    const emptyTargets = id === "empty-targets";
    return {
      kind: "available",
      context: {
        submission: { id, processingStatus: "ready-for-review", originalIdentifier: "Government transcript", rightsNote: "Cleared for review." },
        proposal: {
          outputFingerprint: "sha256:server-only-fingerprint",
          candidateClaims: [{ index: 0, statement: "A candidate Claim.", excerpt: "Supporting excerpt.", confidence: 0.9, rationale: "Direct support." }],
        },
        revisionsCreatedFromSubmission: emptyTargets ? [] : [{ id: "revision-1", briefingId: "briefing-1", topic: { title: "Government", slug: "government" }, sequence: 1, draftTitle: "How government works", templateVersion: "v1", createdAt: "2026-08-08T00:00:00.000Z" }],
        sourcesAcceptedFromSubmission: emptyTargets ? [] : [{ id: "source-1", title: "Constitution", publisher: "SSO", sourceType: "legal", canonicalUrl: "https://example.test/constitution", retrievedAt: "2026-08-07T00:00:00.000Z", rightsNote: "Public material.", acceptedAt: "2026-08-08T00:00:00.000Z" }],
      },
    };
  },
};

describe("candidate Claim evidence context private route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

  function app() {
    const instance = buildPrivateApi({
      serviceAuthenticator: { async authenticate(value) { return value === "Bearer test" ? { kind: "private-service" } : null; } },
      publicCatalogue: { findPublishedBriefingBySlug: () => undefined },
      candidateClaimAcceptanceContexts: {
        ...query,
        async getCandidateClaimAcceptanceContext(id) {
          const result = await query.getCandidateClaimAcceptanceContext(id);
          return result.kind === "available"
            ? ({ ...result, context: { ...result.context, processorOutput: "must not cross HTTP" } } as never)
            : result;
        },
      },
    });
    apps.push(instance);
    return instance;
  }

  it("requires the private service credential and returns the exact scoped evidence choices", async () => {
    const instance = app();
    expect((await instance.inject({ method: "GET", url: "/v1/editorial/source-submissions/submission-1/candidate-claim-context" })).statusCode).toBe(401);

    const response = await instance.inject({ method: "GET", url: "/v1/editorial/source-submissions/submission-1/candidate-claim-context", headers: { authorization: "Bearer test" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      submission: { id: "submission-1", processingStatus: "ready-for-review", originalIdentifier: "Government transcript", rightsNote: "Cleared for review." },
      proposal: { outputFingerprint: "sha256:server-only-fingerprint", candidateClaims: [{ index: 0, statement: "A candidate Claim.", excerpt: "Supporting excerpt.", confidence: 0.9, rationale: "Direct support." }] },
      revisionsCreatedFromSubmission: [{ id: "revision-1", briefingId: "briefing-1", topic: { title: "Government", slug: "government" }, sequence: 1, draftTitle: "How government works", templateVersion: "v1", createdAt: "2026-08-08T00:00:00.000Z" }],
      sourcesAcceptedFromSubmission: [{ id: "source-1", title: "Constitution", publisher: "SSO", sourceType: "legal", canonicalUrl: "https://example.test/constitution", retrievedAt: "2026-08-07T00:00:00.000Z", rightsNote: "Public material.", acceptedAt: "2026-08-08T00:00:00.000Z" }],
    });
    expect(JSON.stringify(response.json())).not.toContain("processorOutput");
  });

  it("uses stable 404 and 422 errors for absent and non-reviewable Submissions", async () => {
    const instance = app();
    const headers = { authorization: "Bearer test" };
    const missing = await instance.inject({ method: "GET", url: "/v1/editorial/source-submissions/missing/candidate-claim-context", headers });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: "not_found", message: "The requested Source Submission does not exist." } });
    const unavailable = await instance.inject({ method: "GET", url: "/v1/editorial/source-submissions/not-ready/candidate-claim-context", headers });
    expect(unavailable.statusCode).toBe(422);
    expect(unavailable.json()).toEqual({ error: { code: "validation_failed", message: "The Source Submission has no reviewable proposal." } });
  });

  it("returns empty same-submission choices as an informative successful context", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/v1/editorial/source-submissions/empty-targets/candidate-claim-context",
      headers: { authorization: "Bearer test" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      submission: { id: "empty-targets" },
      revisionsCreatedFromSubmission: [],
      sourcesAcceptedFromSubmission: [],
    });
  });
});
