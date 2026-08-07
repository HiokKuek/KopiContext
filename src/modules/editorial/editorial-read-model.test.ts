import { describe, expect, it } from "vitest";

import {
  allowedEditorialWorkflowActions,
  assessTemplateSections,
  freshnessFrom,
} from "./editorial-read-model";

const completeContent = {
  oneSentenceExplanation: "One sentence.",
  thirtySecondOverview: "Overview.",
  fiveMinuteExplanation: "Explanation.",
  whyPeopleCare: "Useful context.",
  keyTerms: [{ term: "Term", definition: "Definition" }],
  entities: ["Parliament"],
  debates: ["Question"],
  singaporeSeaAngle: "Singapore context.",
  questionsToAsk: ["What changed?"],
  mistakesToAvoid: ["Do not assume."],
};

describe("editorial read-model policy", () => {
  it("offers only the next workflow actions that the same domain policy permits", () => {
    expect(
      allowedEditorialWorkflowActions({
        id: "briefing-1",
        status: "approved",
        revisionId: "revision-1",
        template: { isComplete: true },
        acceptedSources: [{ id: "source-1" }],
        claims: [{ id: "claim-1", isSupported: true }],
      }),
    ).toEqual(["return-to-draft", "move-to-needs-verification", "publish"]);

    expect(
      allowedEditorialWorkflowActions({
        id: "briefing-1",
        status: "approved",
        revisionId: "revision-1",
        template: { isComplete: false },
        acceptedSources: [],
        claims: [],
      }),
    ).toEqual(["return-to-draft", "move-to-needs-verification"]);
    expect(
      allowedEditorialWorkflowActions({
        id: "briefing-1",
        status: "archived",
        revisionId: "revision-1",
        template: { isComplete: true },
        acceptedSources: [{ id: "source-1" }],
        claims: [{ id: "claim-1", isSupported: true }],
      }),
    ).toEqual(["restore"]);
  });

  it("shows each required v1 section and does not treat an unknown template as complete", () => {
    expect(assessTemplateSections("v1", completeContent)).toEqual(
      expect.arrayContaining([{ key: "keyTerms", label: "Key terms", state: "complete" }]),
    );
    expect(assessTemplateSections("v1", { ...completeContent, debates: [] })).toEqual(
      expect.arrayContaining([{ key: "debates", label: "Debates", state: "missing" }]),
    );
    expect(assessTemplateSections("v2", completeContent).every((section) => section.state === "missing")).toBe(true);
  });

  it("calculates a stable, non-negative freshness summary", () => {
    expect(
      freshnessFrom(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-07-01T12:00:00.000Z"),
        180,
      ),
    ).toEqual({ lastActivityAt: "2026-01-01T00:00:00.000Z", reviewAgeDays: 181, isStale: true });
  });
});
