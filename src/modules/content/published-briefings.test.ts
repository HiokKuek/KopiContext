import { describe, expect, it } from "vitest";

import {
  getPublishedBriefingBySlug,
  type BriefingVisualExplainer,
} from "./published-briefings";

function citedSourceIds(explainer: BriefingVisualExplainer): ReadonlyArray<string> {
  switch (explainer.kind) {
    case "concept-map":
      return [
        ...explainer.sourceIds,
        ...explainer.nodes.flatMap((node) => node.sourceIds),
      ];
    case "comparison":
      return [
        ...explainer.sourceIds,
        ...explainer.rows.flatMap((row) => row.sourceIds),
      ];
    case "process-flow":
      return [
        ...explainer.sourceIds,
        ...explainer.steps.flatMap((step) => step.sourceIds),
      ];
    case "contextual-callout":
      return explainer.sourceIds;
  }
}

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
    const explainers = briefing?.visualExplainers;

    expect(explainers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "comparison", id: "government-roles" }),
        expect.objectContaining({ kind: "process-flow", id: "government-policy-flow" }),
        expect.objectContaining({ kind: "contextual-callout", id: "government-policy-example" }),
      ]),
    );
    expect(explainers?.find((explainer) => explainer.kind === "concept-map")).toMatchObject({
      id: "government-branches",
      title: "The big picture",
      centralLabel: "Singapore Government",
      nodes: [
        { id: "legislature", label: "Legislature" },
        { id: "executive", label: "Executive" },
        { id: "judiciary", label: "Judiciary" },
      ],
    });
  });

  it("keeps the President's constitutional role clear without putting the office in a branch", () => {
    const map = getPublishedBriefingBySlug("how-singapores-government-works")?.visualExplainers?.find(
      (explainer) => explainer.kind === "concept-map",
    );

    expect(map?.kind).toBe("concept-map");
    if (map?.kind !== "concept-map") throw new Error("Expected a concept map");

    expect(map.nodes.flatMap((node) => node.details)).not.toContain("President");
    expect(map.nodes.find((node) => node.id === "legislature")?.note).toContain(
      "not a member of the three branches",
    );
  });

  it("keeps every civic model source reference traceable to a listed source", () => {
    const briefing = getPublishedBriefingBySlug("how-singapores-government-works");
    const sourceIds = new Set(briefing?.sources.map((source) => source.id));
    const allCitedSourceIds = briefing?.visualExplainers?.flatMap(citedSourceIds) ?? [];

    expect(allCitedSourceIds).not.toHaveLength(0);
    expect(allCitedSourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
  });

  it("does not return an unpublished Briefing", () => {
    expect(getPublishedBriefingBySlug("draft-government-briefing")).toBeUndefined();
  });

  it("returns no result for an unknown slug", () => {
    expect(getPublishedBriefingBySlug("not-a-topic")).toBeUndefined();
  });
});
