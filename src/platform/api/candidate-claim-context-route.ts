import type { FastifyInstance } from "fastify";

import type {
  CandidateClaimAcceptanceContext,
  CandidateClaimAcceptanceContextQuery,
} from "@/modules/evidence/candidate-claim-acceptance-context";

export function registerCandidateClaimAcceptanceContextRoute(
  app: FastifyInstance,
  query: CandidateClaimAcceptanceContextQuery,
  errors: Readonly<{ invalid: (message: string) => Error; notFound: () => Error; unavailable: () => Error }>,
): void {
  app.get<{ Params: unknown }>(
    "/v1/editorial/source-submissions/:submissionId/candidate-claim-context",
    async (request) => {
      const id = (request.params as Record<string, unknown>).submissionId;
      if (typeof id !== "string" || !id.trim() || id.length > 200) {
        throw errors.invalid("submissionId must be a non-empty string.");
      }
      const result = await query.getCandidateClaimAcceptanceContext(id.trim());
      if (result.kind === "not-found") throw errors.notFound();
      if (result.kind === "proposal-unavailable") throw errors.unavailable();
      if (result.kind !== "available") throw errors.unavailable();
      return serializeContext(result.context);
    },
  );
}

/** Exact BFF DTO: do not pass accidental repository fields through this boundary. */
function serializeContext(context: CandidateClaimAcceptanceContext): CandidateClaimAcceptanceContext {
  return {
    submission: { ...context.submission },
    proposal: {
      outputFingerprint: context.proposal.outputFingerprint,
      candidateClaims: context.proposal.candidateClaims.map((claim) => ({ ...claim })),
    },
    revisionsCreatedFromSubmission: context.revisionsCreatedFromSubmission.map((revision) => ({
      id: revision.id,
      briefingId: revision.briefingId,
      topic: { ...revision.topic },
      sequence: revision.sequence,
      draftTitle: revision.draftTitle,
      templateVersion: revision.templateVersion,
      createdAt: revision.createdAt,
    })),
    sourcesAcceptedFromSubmission: context.sourcesAcceptedFromSubmission.map((source) => ({ ...source })),
  };
}
