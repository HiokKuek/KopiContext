import { describe, expect, it } from "vitest";

import { draftTitleFrom, preparedProposal } from "./candidate-claim-acceptance-context-repository";

const proposal = {
  classification: { proposedTopic: "Government", confidence: 0.9, rationale: "Civic context." },
  candidateClaims: [{ statement: "Parliament considers Bills.", excerpt: "Parliament considers Bills.", confidence: 0.8, rationale: "Direct wording." }],
  draft: { templateVersion: "v1", title: "How Parliament works", sections: [{ section: "Overview", body: "A short explanation." }] },
  risks: [],
  provider: "provider",
  model: "model",
  promptVersion: "v1",
};

describe("candidate Claim evidence-context mappings", () => {
  it("keeps the safe output fingerprint and indexed candidate fields, without exposing other proposal fields", () => {
    const result = preparedProposal({ preparationResultState: "prepared", processorOutput: proposal });
    expect(result).toMatchObject({
      outputFingerprint: expect.stringMatching(/^sha256:/),
      candidateClaims: [{ index: 0, statement: "Parliament considers Bills.", excerpt: "Parliament considers Bills.", confidence: 0.8, rationale: "Direct wording." }],
    });
    expect(JSON.stringify(result)).not.toContain("provider");
    expect(JSON.stringify(result)).not.toContain("risks");
  });

  it("refuses non-ready or malformed processor output and only reads a meaningful draft title", () => {
    expect(preparedProposal({ preparationResultState: "failed", processorOutput: proposal })).toBeUndefined();
    expect(preparedProposal({ preparationResultState: "prepared", processorOutput: { candidateClaims: [] } })).toBeUndefined();
    expect(draftTitleFrom({ title: "  Draft title " })).toBe("  Draft title ");
    expect(draftTitleFrom({ title: " " })).toBeUndefined();
  });
});
