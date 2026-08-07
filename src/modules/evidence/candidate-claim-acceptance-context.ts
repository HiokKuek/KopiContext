/**
 * Editor-only evidence context for accepting one agent-proposed candidate
 * Claim. The output fingerprint is an input to a later BFF command and must
 * remain on the server; it is not browser presentation data.
 */
export type CandidateClaimAcceptanceContext = Readonly<{
  submission: Readonly<{
    id: string;
    processingStatus: "ready-for-review" | "escalated";
    originalIdentifier: string;
    rightsNote: string;
  }>;
  proposal: Readonly<{
    outputFingerprint: string;
    candidateClaims: ReadonlyArray<Readonly<{
      index: number;
      statement: string;
      excerpt: string;
      confidence: number;
      rationale: string;
    }>>;
  }>;
  revisionsCreatedFromSubmission: ReadonlyArray<Readonly<{
    id: string;
    briefingId: string;
    topic: Readonly<{ title: string; slug: string }>;
    sequence: number;
    draftTitle: string;
    templateVersion: string;
    createdAt: string;
  }>>;
  sourcesAcceptedFromSubmission: ReadonlyArray<Readonly<{
    id: string;
    title: string;
    publisher: string;
    sourceType: string;
    canonicalUrl: string;
    retrievedAt: string;
    rightsNote: string;
    acceptedAt: string;
  }>>;
}>;

export type CandidateClaimAcceptanceContextResult =
  | Readonly<{ kind: "available"; context: CandidateClaimAcceptanceContext }>
  | Readonly<{ kind: "not-found" | "proposal-unavailable" }>;

/** Framework-independent private read port for the candidate-Claim BFF. */
export type CandidateClaimAcceptanceContextQuery = Readonly<{
  getCandidateClaimAcceptanceContext(
    submissionId: string,
  ): Promise<CandidateClaimAcceptanceContextResult>;
}>;
