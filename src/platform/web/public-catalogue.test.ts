import { describe, expect, it, vi } from "vitest";

import type { PublishedBriefing } from "@/modules/content/published-briefings";

import { PrivateApiClientError } from "./private-api-client";
import { createPublicCatalogueFromEnvironment, privateApiCatalogue } from "./public-catalogue";

const briefing: PublishedBriefing = {
  slug: "how-singapores-government-works",
  title: "How Singapore's Government Works",
  status: "published",
  templateVersion: "v1",
  oneSentenceExplanation: "A concise explanation.",
  thirtySecondOverview: "A quick overview.",
  fiveMinuteExplanation: "A fuller explanation.",
  whyPeopleCare: "It helps people participate.",
  keyTerms: [],
  entities: [],
  debates: [],
  singaporeSeaAngle: "Singapore context.",
  questionsToAsk: [],
  mistakesToAvoid: [],
  sources: [],
  lastReviewedAt: "2026-08-07",
};

describe("public catalogue composition", () => {
  it("uses checked-in fixtures only when local-development is explicit", async () => {
    const catalogue = createPublicCatalogueFromEnvironment({ PUBLIC_CATALOGUE_RUNTIME_MODE: "local-development" });
    await expect(catalogue.findPublishedBriefingBySlug("how-singapores-government-works")).resolves.toMatchObject({ status: "published" });
    await expect(catalogue.findPublishedBriefingBySlug("draft-government-briefing")).resolves.toBeUndefined();
  });

  it("requires private API configuration by default rather than silently falling back to fixtures", () => {
    expect(() => createPublicCatalogueFromEnvironment({})).toThrow("PUBLIC_CATALOGUE_SLUGS");
    expect(() => createPublicCatalogueFromEnvironment({ PUBLIC_CATALOGUE_RUNTIME_MODE: "preview" })).toThrow(
      "PUBLIC_CATALOGUE_RUNTIME_MODE",
    );
  });

  it("retrieves only configured published Briefings through the server-side private API client", async () => {
    const getPublishedBriefing = vi.fn().mockResolvedValue(briefing);
    const catalogue = privateApiCatalogue({ getPublishedBriefing }, [briefing.slug]);
    await expect(catalogue.listPublishedBriefings()).resolves.toEqual([briefing]);
    await expect(catalogue.findPublishedBriefingBySlug("not-configured")).resolves.toBeUndefined();
    expect(getPublishedBriefing).toHaveBeenCalledWith(briefing.slug);
    expect(getPublishedBriefing).toHaveBeenCalledTimes(1);
  });

  it("does not show a missing or malformed private API result to readers", async () => {
    const missing = privateApiCatalogue({
      getPublishedBriefing: vi.fn().mockRejectedValue(new PrivateApiClientError("not_found", "Missing", 404)),
    }, [briefing.slug]);
    await expect(missing.findPublishedBriefingBySlug(briefing.slug)).resolves.toBeUndefined();

    const malformed = privateApiCatalogue({
      getPublishedBriefing: vi.fn().mockResolvedValue({ ...briefing, status: "draft" }),
    }, [briefing.slug]);
    await expect(malformed.findPublishedBriefingBySlug(briefing.slug)).resolves.toBeUndefined();
  });
});
