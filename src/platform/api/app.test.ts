import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";
import type { PublishedBriefing } from "@/modules/content/published-briefings";
import type { EditorialReadRepository } from "@/modules/editorial/editorial-read-model";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test-credential" ? { kind: "private-service" } : null;
  },
};

const publishedBriefing: PublishedBriefing = {
  slug: "how-singapores-government-works",
  title: "How Singapore's Government Works",
  status: "published",
  templateVersion: "v1",
  oneSentenceExplanation: "A short explanation.",
  thirtySecondOverview: "A short overview.",
  fiveMinuteExplanation: "A longer explanation.",
  whyPeopleCare: "It helps people participate.",
  keyTerms: [],
  entities: [],
  debates: [],
  singaporeSeaAngle: "It is relevant in Singapore.",
  questionsToAsk: [],
  mistakesToAvoid: [],
  sources: [],
  lastReviewedAt: "2026-08-07",
};

const publicCatalogue: PublicCatalogueQuery = {
  findPublishedBriefingBySlug(slug) {
    return slug === publishedBriefing.slug ? publishedBriefing : undefined;
  },
};

const editorialReadModels: EditorialReadRepository = {
  async listEditorialWork() {
    return {
      countsByStatus: {
        draft: 0,
        "needs-verification": 1,
        "in-editorial-review": 0,
        approved: 0,
        published: 0,
        archived: 0,
      },
      items: [{
        briefingId: "briefing-1",
        title: "How Singapore's Government Works",
        topicTitle: "Singapore Government",
        status: "needs-verification",
        revisionId: "revision-1",
        revisionCreatedAt: "2026-08-01T00:00:00.000Z",
        freshness: { lastActivityAt: "2026-08-02T00:00:00.000Z", reviewAgeDays: 5, isStale: false },
        completeness: {
          isComplete: false,
          missingSectionCount: 1,
          claimCount: 2,
          unsupportedClaimCount: 1,
          acceptedSourceCount: 1,
        },
      }],
    };
  },
  async getEditorialBriefing(briefingId) {
    if (briefingId !== "briefing-1") return undefined;
    return {
      briefing: {
        id: "briefing-1",
        title: "How Singapore's Government Works",
        topic: { id: "topic-1", slug: "how-government-works", title: "Singapore Government" },
        status: "needs-verification",
      },
      revision: {
        id: "revision-1",
        sequence: 1,
        templateVersion: "v1",
        content: { oneSentenceExplanation: "A source-backed explanation." },
        origin: "agent",
        createdBy: "preparation-worker",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      templateSections: [{ key: "oneSentenceExplanation", label: "One-sentence explanation", state: "complete" }],
      claims: [{
        id: "claim-1",
        statement: "The Government has three organs of state.",
        status: "verified",
        supports: [{
          id: "support-1",
          sourceId: "source-1",
          kind: "direct",
          addedBy: "editor-1",
          addedAt: "2026-08-01T00:00:00.000Z",
        }],
      }],
      acceptedSources: [{
        id: "source-1",
        title: "Constitution",
        publisher: "Singapore Statutes Online",
        sourceType: "legal",
        canonicalUrl: "https://example.test/constitution",
        retrievedAt: "2026-08-01T00:00:00.000Z",
        relation: "Supports the claim.",
        rightsNote: "Public legal material.",
        acceptedBy: "editor-1",
        acceptedAt: "2026-08-01T00:00:00.000Z",
        submission: {
          id: "submission-1",
          kind: "transcript",
          originalIdentifier: "Government video transcript",
          submittedBy: "editor-1",
          submittedAt: "2026-07-30T00:00:00.000Z",
          rightsNote: "Submitted for review.",
          processingStatus: "ready-for-review",
        },
      }],
      freshness: { lastActivityAt: "2026-08-02T00:00:00.000Z", reviewAgeDays: 5, isStale: false },
      auditRecords: [],
      allowedActions: ["start-editorial-review"],
    };
  },
};

describe("private application API", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp() {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      now: () => new Date("2026-08-07T09:30:00.000Z"),
    });
    apps.push(app);
    return app;
  }

  it("returns the versioned health contract to an authenticated private service", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/healthz",
      headers: { authorization: "Bearer test-credential" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      version: "v1",
      checkedAt: "2026-08-07T09:30:00.000Z",
    });
  });

  it("rejects every versioned endpoint without a valid service credential", async () => {
    const response = await createApp().inject({ method: "GET", url: "/v1/healthz" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "unauthorized", message: "A valid service credential is required." },
    });
  });

  it("uses the stable error envelope for unknown endpoints", async () => {
    const response = await createApp().inject({ method: "GET", url: "/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: "The requested endpoint does not exist." },
    });
  });

  it("returns a published Briefing to an anonymous reader", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/public/briefings/how-singapores-government-works",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(publishedBriefing);
  });

  it("uses the stable not-found envelope when a public Briefing is absent", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/public/briefings/not-a-topic",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: "The requested Briefing does not exist." },
    });
  });

  it("does not expose an unpublished Briefing when a catalogue adapter returns one", async () => {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue: {
        findPublishedBriefingBySlug: () => ({ ...publishedBriefing, status: "draft" }),
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/public/briefings/draft-government-briefing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: "The requested Briefing does not exist." },
    });
  });

  it("allows anonymous analytics only through the explicitly public feature route", async () => {
    const record = vi.fn();
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      anonymousAnalyticsEvents: { record },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/public/analytics/events",
      payload: {
        type: "page-view",
        session: { id: "kc_session_opaque-session-token", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:01:00.000Z",
        path: "/",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(record).toHaveBeenCalledOnce();
  });

  it("requires the private service credential for editor queue and review queries", async () => {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      editorialReadModels,
    });
    apps.push(app);

    const [queue, review] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/editorial/work" }),
      app.inject({ method: "GET", url: "/v1/editorial/briefings/briefing-1" }),
    ]);
    expect(queue.statusCode).toBe(401);
    expect(review.statusCode).toBe(401);
  });

  it("returns a minimised editorial queue and review aggregate only to the private service", async () => {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      editorialReadModels: {
        ...editorialReadModels,
        async getEditorialBriefing(briefingId) {
          const briefing = await editorialReadModels.getEditorialBriefing(briefingId);
          return briefing && ({ ...briefing, processorOutput: { rawPrompt: "must not leave the private adapter" } } as never);
        },
      },
    });
    apps.push(app);

    const queue = await app.inject({
      method: "GET",
      url: "/v1/editorial/work",
      headers: { authorization: "Bearer test-credential" },
    });
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toMatchObject({
      countsByStatus: { "needs-verification": 1 },
      items: [{ briefingId: "briefing-1", completeness: { unsupportedClaimCount: 1 } }],
    });
    expect(queue.json().items[0]).not.toHaveProperty("content");

    const review = await app.inject({
      method: "GET",
      url: "/v1/editorial/briefings/briefing-1",
      headers: { authorization: "Bearer test-credential" },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toMatchObject({
      briefing: { id: "briefing-1", status: "needs-verification" },
      acceptedSources: [{ submission: { id: "submission-1", kind: "transcript" } }],
      allowedActions: ["start-editorial-review"],
    });
    expect(JSON.stringify(review.json())).not.toContain("processorOutput");
    expect(JSON.stringify(review.json())).not.toContain("rawPrompt");
  });

  it("uses the stable error envelope when an editor briefing is absent or malformed", async () => {
    const app = buildPrivateApi({ serviceAuthenticator: acceptedAuthenticator, publicCatalogue, editorialReadModels });
    apps.push(app);
    const absent = await app.inject({
      method: "GET",
      url: "/v1/editorial/briefings/missing",
      headers: { authorization: "Bearer test-credential" },
    });
    expect(absent.statusCode).toBe(404);
    expect(absent.json()).toEqual({
      error: { code: "not_found", message: "The requested Briefing does not exist." },
    });

    const malformed = await app.inject({
      method: "GET",
      url: "/v1/editorial/briefings/%20",
      headers: { authorization: "Bearer test-credential" },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      error: { code: "invalid_request", message: "briefingId must be a non-empty string." },
    });
  });
});
