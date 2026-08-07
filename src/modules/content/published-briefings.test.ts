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

  it("gives first-time readers an evidence-backed map before civic detail", () => {
    const briefing = getPublishedBriefingBySlug("how-singapores-government-works");

    expect(briefing?.civicGovernmentModel).toMatchObject({
      title: "The big picture",
      branches: [
        { id: "legislature", name: "Legislature" },
        { id: "executive", name: "Executive" },
        { id: "judiciary", name: "Judiciary" },
      ],
      officeComparison: {
        question: "Who runs Singapore day to day?",
        roles: [
          { role: "President" },
          { role: "Prime Minister" },
          { role: "Cabinet" },
        ],
      },
      policyFlow: { exampleTitle: "Example: a public-housing policy change" },
    });
  });

  it("keeps the President's constitutional role clear without putting the office in a branch", () => {
    const model = getPublishedBriefingBySlug("how-singapores-government-works")?.civicGovernmentModel;

    expect(model?.branches.flatMap((branch) => branch.institutions)).not.toContain("President");
    expect(model?.branches.find((branch) => branch.id === "legislature")?.relationshipNote).toContain(
      "not a member of the three branches",
    );
  });

  it("keeps every civic model source reference traceable to a listed source", () => {
    const briefing = getPublishedBriefingBySlug("how-singapores-government-works");
    const model = briefing?.civicGovernmentModel;
    const sourceIds = new Set(briefing?.sources.map((source) => source.id));
    const citedSourceIds = [
      ...(model?.branches.flatMap((branch) => branch.sourceIds) ?? []),
      ...(model?.officeComparison.roles.flatMap((role) => role.sourceIds) ?? []),
      ...(model?.policyFlow.steps.flatMap((step) => step.sourceIds) ?? []),
    ];

    expect(citedSourceIds).not.toHaveLength(0);
    expect(citedSourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
  });

  it("does not return an unpublished Briefing", () => {
    expect(getPublishedBriefingBySlug("draft-government-briefing")).toBeUndefined();
  });

  it("returns no result for an unknown slug", () => {
    expect(getPublishedBriefingBySlug("not-a-topic")).toBeUndefined();
  });
});
