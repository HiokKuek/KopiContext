import { describe, expect, it } from "vitest";

import {
  evaluateClaimSupport,
  evaluateEvidenceForPublication,
  type AcceptedSource,
  type Claim,
  type SourceSubmission,
} from "./evidence-management";

const transcriptSubmission: SourceSubmission = {
  id: "submission-youtube-transcript",
  kind: "transcript",
  originalIdentifier: "https://www.youtube.com/watch?v=government-explainer",
  submittedAt: "2026-08-07T10:00:00.000Z",
  rightsNote: "Provided by the editor for assessment.",
};

const parliamentarySource: AcceptedSource = {
  id: "source-parliament-about",
  title: "About Parliament",
  publisher: "Parliament of Singapore",
  url: "https://www.parliament.gov.sg/about-us",
  acceptedAt: "2026-08-07T11:00:00.000Z",
  acceptedFromSubmissionId: transcriptSubmission.id,
};

const supportedClaim: Claim = {
  id: "claim-parliament-laws",
  statement: "Parliament debates and passes laws.",
  supportingSourceIds: [parliamentarySource.id],
};

describe("evaluateClaimSupport", () => {
  it("does not treat a Source Submission as accepted evidence", () => {
    expect(
      evaluateClaimSupport(supportedClaim, {
        acceptedSources: [],
        sourceSubmissions: [transcriptSubmission],
      }),
    ).toEqual({ isSupported: false, acceptedSourceIds: [] });
  });

  it("recognises only linked accepted Sources as support", () => {
    expect(
      evaluateClaimSupport(supportedClaim, {
        acceptedSources: [parliamentarySource],
        sourceSubmissions: [transcriptSubmission],
      }),
    ).toEqual({ isSupported: true, acceptedSourceIds: [parliamentarySource.id] });
  });
});

describe("evaluateEvidenceForPublication", () => {
  it("blocks publishability inputs when a Claim has no accepted Source support", () => {
    const unsupportedClaim: Claim = {
      id: "claim-unverified",
      statement: "An unsupported statement must not be published.",
      supportingSourceIds: [transcriptSubmission.id],
    };

    expect(
      evaluateEvidenceForPublication([supportedClaim, unsupportedClaim], {
        acceptedSources: [parliamentarySource],
        sourceSubmissions: [transcriptSubmission],
      }),
    ).toEqual({
      isPublishable: false,
      unsupportedClaimIds: [unsupportedClaim.id],
    });
  });

  it("allows evidence inputs when every Claim has accepted Source support", () => {
    expect(
      evaluateEvidenceForPublication([supportedClaim], {
        acceptedSources: [parliamentarySource],
        sourceSubmissions: [transcriptSubmission],
      }),
    ).toEqual({ isPublishable: true, unsupportedClaimIds: [] });
  });
});
