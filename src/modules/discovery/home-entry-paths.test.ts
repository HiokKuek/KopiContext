import { describe, expect, it } from "vitest";

import type { PublishedBriefing } from "@/modules/content/published-briefings";

import { homeEntryPaths } from "./home-entry-paths";

function briefing(slug: string): PublishedBriefing {
  return {
    slug,
    title: slug,
    status: "published",
    templateVersion: "v1",
    oneSentenceExplanation: "A one-sentence explanation.",
    thirtySecondOverview: "An overview.",
    fiveMinuteExplanation: "An explanation.",
    whyPeopleCare: "Why it matters.",
    keyTerms: [],
    entities: [],
    debates: [],
    singaporeSeaAngle: "Singapore context.",
    questionsToAsk: [],
    mistakesToAvoid: [],
    sources: [],
    lastReviewedAt: "2026-08-07T00:00:00.000Z",
  };
}

describe("homeEntryPaths", () => {
  it("uses the published civic map as the first read and keeps all other Briefings available", () => {
    const government = briefing("how-singapores-government-works");
    const housing = briefing("public-housing");

    expect(homeEntryPaths([housing, government])).toEqual({ featured: government, additional: [housing] });
  });

  it("falls back to the deliberately supplied catalogue order", () => {
    const housing = briefing("public-housing");

    expect(homeEntryPaths([housing])).toEqual({ featured: housing, additional: [] });
  });
});
