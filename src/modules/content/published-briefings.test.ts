import { describe, expect, it } from "vitest";

import { getPublishedBriefingBySlug } from "./published-briefings";

describe("getPublishedBriefingBySlug", () => {
  it("returns the published civic Briefing by its slug", () => {
    expect(getPublishedBriefingBySlug("how-singapores-government-works")).toMatchObject({
      slug: "how-singapores-government-works",
      status: "published",
      title: "How Singapore's Government Works",
      templateVersion: "v1",
    });
  });

  it("does not return an unpublished Briefing", () => {
    expect(getPublishedBriefingBySlug("draft-government-briefing")).toBeUndefined();
  });

  it("returns no result for an unknown slug", () => {
    expect(getPublishedBriefingBySlug("not-a-topic")).toBeUndefined();
  });
});
