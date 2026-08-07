import { describe, expect, it } from "vitest";

import {
  editorialTransitionPersistenceRequest,
  isCompleteBriefingTemplate,
  mapEditorialAuditRecord,
  mapEditorialItem,
  mapEditorialRevision,
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

describe("Drizzle editorial repository mappings", () => {
  it("maps only accepted Claim support into the editorial publication facts", () => {
    expect(
      mapEditorialItem({
        id: "briefing-1",
        status: "approved",
        revisionId: "revision-2",
        templateVersion: "v1",
        content: templateContent,
        claimRows: [
          { claimId: "claim-supported", supportId: "support-1", acceptedSourceId: "source-1" },
          { claimId: "claim-supported", supportId: "support-2", acceptedSourceId: "source-1" },
          { claimId: "claim-unsupported", supportId: null, acceptedSourceId: null },
        ],
      }),
    ).toEqual({
      id: "briefing-1",
      status: "approved",
      revisionId: "revision-2",
      template: { isComplete: true },
      acceptedSources: [{ id: "source-1" }],
      claims: [
        { id: "claim-supported", isSupported: true },
        { id: "claim-unsupported", isSupported: false },
      ],
    });
  });

  it("does not mistake malformed or unknown-version revision JSON for a complete template", () => {
    expect(isCompleteBriefingTemplate("v1", templateContent)).toBe(true);
    expect(isCompleteBriefingTemplate("v2", templateContent)).toBe(false);
    expect(isCompleteBriefingTemplate("v1", { ...templateContent, entities: "Parliament" })).toBe(false);
  });

  it("maps immutable revisions and nullable audit reasons without leaking mutable database JSON", () => {
    const content = { section: { text: "Original" } };
    const revision = mapEditorialRevision({
      id: "revision-2",
      itemId: "briefing-1",
      sequence: 2,
      templateVersion: "v1",
      content,
      createdAt: new Date("2026-08-07T09:00:00.000Z"),
    });
    (content.section as { text: string }).text = "Changed";

    expect(revision).toEqual({
      id: "revision-2",
      itemId: "briefing-1",
      sequence: 2,
      templateVersion: "v1",
      content: { section: { text: "Original" } },
      createdAt: "2026-08-07T09:00:00.000Z",
    });
    expect(
      mapEditorialAuditRecord({
        itemId: "briefing-1",
        revisionId: "revision-2",
        from: "approved",
        to: "published",
        actorId: "editor-1",
        reason: null,
        occurredAt: new Date("2026-08-07T10:00:00.000Z"),
      }),
    ).toEqual({
      itemId: "briefing-1",
      revisionId: "revision-2",
      from: "approved",
      to: "published",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:00:00.000Z",
    });
  });
});
