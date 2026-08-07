/**
 * Material awaiting assessment. A submission preserves provenance, but cannot
 * support a Claim until an editor has accepted a distinct Source record.
 */
export type SourceSubmission = {
  id: string;
  kind: "url" | "document" | "transcript";
  originalIdentifier: string;
  submittedAt: string;
  rightsNote: string;
};

/**
 * A reference the editor has accepted as evidence that may support Claims.
 */
export type AcceptedSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  acceptedAt: string;
  acceptedFromSubmissionId?: string;
};

/** A factual statement and the accepted Sources proposed to support it. */
export type Claim = {
  id: string;
  statement: string;
  supportingSourceIds: ReadonlyArray<string>;
};

export type EvidenceCatalog = {
  acceptedSources: ReadonlyArray<AcceptedSource>;
  sourceSubmissions: ReadonlyArray<SourceSubmission>;
};

export type ClaimSupport = {
  isSupported: boolean;
  acceptedSourceIds: ReadonlyArray<string>;
};

export type PublicationEvidenceResult = {
  isPublishable: boolean;
  unsupportedClaimIds: ReadonlyArray<string>;
};

/**
 * Returns the accepted Sources that support one Claim. Source Submissions are
 * intentionally not consulted: retaining submitted material is not editorial
 * acceptance of its contents.
 */
export function evaluateClaimSupport(claim: Claim, catalog: EvidenceCatalog): ClaimSupport {
  const acceptedSourceIds = new Set(catalog.acceptedSources.map((source) => source.id));
  const supportingAcceptedSourceIds = claim.supportingSourceIds.filter((sourceId) =>
    acceptedSourceIds.has(sourceId),
  );

  return {
    isSupported: supportingAcceptedSourceIds.length > 0,
    acceptedSourceIds: supportingAcceptedSourceIds,
  };
}

/**
 * Supplies the evidence portion of a publishability decision. The editorial
 * workflow owns the overall decision and must combine this result with its
 * Template and approval requirements.
 */
export function evaluateEvidenceForPublication(
  claims: ReadonlyArray<Claim>,
  catalog: EvidenceCatalog,
): PublicationEvidenceResult {
  const unsupportedClaimIds = claims
    .filter((claim) => !evaluateClaimSupport(claim, catalog).isSupported)
    .map((claim) => claim.id);

  return {
    isPublishable: unsupportedClaimIds.length === 0,
    unsupportedClaimIds,
  };
}
