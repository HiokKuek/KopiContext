import { describe, expect, it } from "vitest";

import {
  editorialTransitionPersistenceRequest,
  mapPublishedBriefing,
} from "./content-repositories";

const templateContent = {
  oneSentenceExplanation: "A concise explanation.",
  thirtySecondOverview: "A quick overview.",
  fiveMinuteExplanation: "A fuller explanation.",
  whyPeopleCare: "It helps people participate.",
  keyTerms: [{ term: "Term", definition: "A clear definition." }],
  entities: ["Parliament"],
  debates: ["A genuine question"],
  singaporeSeaAngle: "Singapore context.",
  questionsToAsk: ["What changed?"],
  mistakesToAvoid: ["Do not overgeneralise."],
};

describe("mapPublishedBriefing", () => {
  it("maps a published revision and its accepted Claim Sources to the public contract", () => {
    expect(
      mapPublishedBriefing({
        slug: "government",
        title: "Government",
        templateVersion: "v1",
        content: templateContent,
        publishedAt: new Date("2026-08-07T15:30:00.000Z"),
        sources: [
          { title: "Constitution", publisher: "SSO", url: "https://sso.example/constitution" },
          { title: "Constitution", publisher: "SSO", url: "https://sso.example/constitution" },
        ],
      }),
    ).toEqual({
      slug: "government",
      title: "Government",
      status: "published",
      templateVersion: "v1",
      ...templateContent,
      sources: [{ title: "Constitution", publisher: "SSO", url: "https://sso.example/constitution" }],
      lastReviewedAt: "2026-08-07",
    });
  });

  it("refuses unsupported template versions and malformed template content", () => {
    expect(
      mapPublishedBriefing({
        slug: "government",
        title: "Government",
        templateVersion: "v2",
        content: templateContent,
        publishedAt: new Date("2026-08-07T15:30:00.000Z"),
        sources: [],
      }),
    ).toBeUndefined();

    expect(
      mapPublishedBriefing({
        slug: "government",
        title: "Government",
        templateVersion: "v1",
        content: { ...templateContent, keyTerms: [{ term: "Missing definition" }] },
        publishedAt: new Date("2026-08-07T15:30:00.000Z"),
        sources: [],
      }),
    ).toBeUndefined();
  });
});

describe("editorialTransitionPersistenceRequest", () => {
  it("maps an evaluated transition without changing the editorial decision", () => {
    expect(
      editorialTransitionPersistenceRequest({
        ok: true,
        item: {
          id: "briefing-1",
          status: "published",
          revisionId: "revision-4",
          template: { isComplete: true },
          acceptedSources: [{ id: "source-1" }],
          claims: [{ id: "claim-1", isSupported: true }],
        },
        audit: {
          itemId: "briefing-1",
          revisionId: "revision-4",
          from: "approved",
          to: "published",
          actorId: "editor-1",
          reason: "All checks passed.",
          occurredAt: "2026-08-07T15:30:00.000Z",
        },
      }),
    ).toEqual({
      briefingId: "briefing-1",
      revisionId: "revision-4",
      from: "approved",
      to: "published",
      actorId: "editor-1",
      reason: "All checks passed.",
      occurredAt: "2026-08-07T15:30:00.000Z",
    });
  });
});
