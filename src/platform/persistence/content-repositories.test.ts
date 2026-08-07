import { describe, expect, it } from "vitest";

import {
  editorialTransitionPersistenceRequest,
  isCompleteBriefingTemplate,
  mapEditorialAuditRecord,
  mapEditorialItem,
  mapEditorialRevision,
  mapPublishedBriefing,
} from "./content-repositories";
import { mapReviewEvidence } from "./editorial-read-repository";

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
        currentUpdates: [{ id: "update-1", title: "A dated development", body: "A concise explanation.", effectiveAt: "2026-08-08T00:00:00.000Z", sources: [{ title: "Update source", publisher: "SSO", url: "https://sso.example/update" }] }],
      }),
    ).toEqual({
      slug: "government",
      title: "Government",
      status: "published",
      templateVersion: "v1",
      ...templateContent,
      sources: [{ title: "Constitution", publisher: "SSO", url: "https://sso.example/constitution" }],
      currentUpdates: [{ id: "update-1", title: "A dated development", body: "A concise explanation.", effectiveAt: "2026-08-08T00:00:00.000Z", sources: [{ title: "Update source", publisher: "SSO", url: "https://sso.example/update" }] }],
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

  it("retains an optional orientation visual in the public revision contract", () => {
    const visualExplainers = [{ kind: "contextual-callout" as const, id: "orientation", title: "The map", body: "Start here.", sourceIds: ["source-1"] }];
    expect(mapPublishedBriefing({
      slug: "government", title: "Government", templateVersion: "v1", content: { ...templateContent, visualExplainers }, publishedAt: new Date("2026-08-07T15:30:00.000Z"), sources: [],
    })).toMatchObject({ visualExplainers });
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

describe("editorial review evidence mapping", () => {
  it("retains support and accepted-source provenance while excluding raw preparation payloads", () => {
    const rows: Parameters<typeof mapReviewEvidence>[0] = [
      {
        claimId: "claim-1",
        statement: "A supported statement.",
        claimStatus: "verified",
        supportId: "support-1",
        supportKind: "direct",
        locator: "Section 3",
        excerpt: "The relevant passage.",
        rationale: null,
        supportAddedBy: "editor-1",
        supportAddedAt: new Date("2026-08-01T00:00:00.000Z"),
        sourceId: "source-1",
        sourceTitle: "Official source",
        sourcePublisher: "Publisher",
        sourceType: "web",
        canonicalUrl: "https://example.test/source",
        externalIdentifier: null,
        sourcePublishedAt: null,
        sourceRetrievedAt: new Date("2026-07-01T00:00:00.000Z"),
        sourceRelation: "Supports the claim.",
        sourceRightsNote: "Public material.",
        acceptedBy: "editor-1",
        acceptedAt: new Date("2026-08-01T00:00:00.000Z"),
        submissionId: "submission-1",
        submissionKind: "transcript",
        originalIdentifier: "Government briefing transcript",
        originalUrl: null,
        submittedBy: "editor-1",
        submittedAt: new Date("2026-07-01T00:00:00.000Z"),
        submissionRetrievedAt: null,
        submissionRightsNote: "Editor supplied.",
        processingStatus: "ready-for-review",
        proposedTopic: "Government",
        proposedSubtopic: null,
        classificationConfidence: "0.900",
        classificationRationale: "It explains civic institutions.",
      },
    ];

    const result = mapReviewEvidence(rows);
    expect(result).toMatchObject({
      claims: [{ id: "claim-1", supports: [{ id: "support-1", sourceId: "source-1" }] }],
      sources: [{
        id: "source-1",
        submission: { id: "submission-1", kind: "transcript", processingStatus: "ready-for-review" },
      }],
    });
    expect(JSON.stringify(result)).not.toContain("processorOutput");
    expect(JSON.stringify(result)).not.toContain("processingHistory");
    expect(JSON.stringify(result)).not.toContain("contentFingerprint");
  });

  it("does not turn a Claim without an Accepted Source into evidence", () => {
    const result = mapReviewEvidence([
      {
        claimId: "claim-unsupported",
        statement: "Unverified statement.",
        claimStatus: "candidate",
        supportId: null,
        supportKind: null,
        locator: null,
        excerpt: null,
        rationale: null,
        supportAddedBy: null,
        supportAddedAt: null,
        sourceId: null,
        sourceTitle: null,
        sourcePublisher: null,
        sourceType: null,
        canonicalUrl: null,
        externalIdentifier: null,
        sourcePublishedAt: null,
        sourceRetrievedAt: null,
        sourceRelation: null,
        sourceRightsNote: null,
        acceptedBy: null,
        acceptedAt: null,
        submissionId: null,
        submissionKind: null,
        originalIdentifier: null,
        originalUrl: null,
        submittedBy: null,
        submittedAt: null,
        submissionRetrievedAt: null,
        submissionRightsNote: null,
        processingStatus: null,
        proposedTopic: null,
        proposedSubtopic: null,
        classificationConfidence: null,
        classificationRationale: null,
      },
    ]);
    expect(result).toEqual({
      claims: [{ id: "claim-unsupported", statement: "Unverified statement.", status: "candidate", supports: [] }],
      sources: [],
    });
  });
});
