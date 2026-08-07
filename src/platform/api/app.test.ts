import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";
import type { PublishedBriefing } from "@/modules/content/published-briefings";

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
});
