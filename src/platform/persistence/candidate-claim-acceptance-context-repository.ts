import { and, asc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  fingerprintProposalOutput,
} from "@/modules/editorial/accept-prepared-proposal-command";
import type { AgentPreparationProposal } from "@/modules/preparation/source-preparation";
import type {
  CandidateClaimAcceptanceContext,
  CandidateClaimAcceptanceContextQuery,
  CandidateClaimAcceptanceContextResult,
} from "@/modules/evidence/candidate-claim-acceptance-context";

import { acceptedSources, briefingRevisions, briefings, sourceSubmissions, topics } from "./schema";

/**
 * Deliberately scoped evidence-review adapter. It reads only the requested
 * Submission, the agent-created draft and later human revisions of that same
 * Briefing, and Sources accepted from it;
 * it never selects submitted text, retrieval fingerprints, prompts, worker
 * leases, retries, or other Submissions.
 */
export class DrizzleCandidateClaimAcceptanceContextRepository
  implements CandidateClaimAcceptanceContextQuery {
  constructor(private readonly db: NodePgDatabase) {}

  async getCandidateClaimAcceptanceContext(
    submissionId: string,
  ): Promise<CandidateClaimAcceptanceContextResult> {
    const [submission] = await this.db
      .select({
        id: sourceSubmissions.id,
        originalIdentifier: sourceSubmissions.originalIdentifier,
        rightsNote: sourceSubmissions.rightsNote,
        processingStatus: sourceSubmissions.processingStatus,
        preparationResultState: sourceSubmissions.preparationResultState,
        processorOutput: sourceSubmissions.processorOutput,
      })
      .from(sourceSubmissions)
      .where(eq(sourceSubmissions.id, submissionId))
      .limit(1);
    if (!submission) return { kind: "not-found" };

    const prepared = preparedProposal(submission);
    if (!prepared || (submission.processingStatus !== "ready-for-review" && submission.processingStatus !== "escalated")) {
      return { kind: "proposal-unavailable" };
    }

    const originatingRevisions = await this.db
      .select({ briefingId: briefingRevisions.briefingId })
      .from(briefingRevisions)
      .where(and(eq(briefingRevisions.sourceSubmissionId, submissionId), eq(briefingRevisions.origin, "agent")));
    const briefingIds = [...new Set(originatingRevisions.map((revision) => revision.briefingId))];

    const [revisions, sources] = await Promise.all([
      briefingIds.length === 0 ? Promise.resolve([]) :
      this.db
        .select({
          id: briefingRevisions.id,
          briefingId: briefings.id,
          topicTitle: topics.title,
          topicSlug: topics.slug,
          sequence: briefingRevisions.sequence,
          content: briefingRevisions.content,
          templateVersion: briefingRevisions.templateVersion,
          createdAt: briefingRevisions.createdAt,
        })
        .from(briefingRevisions)
        .innerJoin(briefings, eq(briefings.id, briefingRevisions.briefingId))
        .innerJoin(topics, eq(topics.id, briefings.topicId))
        // A human revision is an immutable successor of the original agent
        // draft. It needs the same separately reviewed evidence, but it must
        // not inherit Claims silently.
        .where(inArray(briefingRevisions.briefingId, briefingIds))
        .orderBy(asc(briefingRevisions.createdAt)),
      this.db
        .select({
          id: acceptedSources.id,
          title: acceptedSources.title,
          publisher: acceptedSources.publisher,
          sourceType: acceptedSources.sourceType,
          canonicalUrl: acceptedSources.canonicalUrl,
          retrievedAt: acceptedSources.retrievedAt,
          rightsNote: acceptedSources.rightsNote,
          acceptedAt: acceptedSources.acceptedAt,
        })
        .from(acceptedSources)
        .where(eq(acceptedSources.acceptedFromSubmissionId, submissionId))
        .orderBy(asc(acceptedSources.acceptedAt)),
    ]);

    return {
      kind: "available",
      context: {
        submission: {
          id: submission.id,
          processingStatus: submission.processingStatus,
          originalIdentifier: submission.originalIdentifier,
          rightsNote: submission.rightsNote,
        },
        proposal: prepared,
        revisionsCreatedFromSubmission: revisions.flatMap((revision) => {
          const draftTitle = draftTitleFrom(revision.content) ?? revision.topicTitle;
          return draftTitle === undefined
            ? []
            : [{
                id: revision.id,
                briefingId: revision.briefingId,
                topic: { title: revision.topicTitle, slug: revision.topicSlug },
                sequence: revision.sequence,
                draftTitle,
                templateVersion: revision.templateVersion,
                createdAt: revision.createdAt.toISOString(),
              }];
        }),
        sourcesAcceptedFromSubmission: sources.map((source) => ({
          ...source,
          retrievedAt: source.retrievedAt.toISOString(),
          acceptedAt: source.acceptedAt.toISOString(),
        })),
      },
    };
  }
}

export function preparedProposal(
  submission: Readonly<{
    preparationResultState: "prepared" | "needs-review" | "duplicate" | "failed" | null;
    processorOutput: unknown;
  }>,
): CandidateClaimAcceptanceContext["proposal"] | undefined {
  if (submission.preparationResultState !== "prepared" && submission.preparationResultState !== "needs-review") {
    return undefined;
  }
  const proposal = asProposal(submission.processorOutput);
  if (!proposal) return undefined;
  return {
    outputFingerprint: fingerprintProposalOutput(proposal),
    candidateClaims: proposal.candidateClaims.map((claim, index) => ({
      index,
      statement: claim.statement,
      excerpt: claim.excerpt,
      confidence: claim.confidence,
      rationale: claim.rationale,
    })),
  };
}

function asProposal(value: unknown): AgentPreparationProposal | undefined {
  if (!isRecord(value) || !isRecord(value.classification) || !isRecord(value.draft)) return undefined;
  if (
    typeof value.classification.proposedTopic !== "string"
    || typeof value.classification.confidence !== "number"
    || typeof value.classification.rationale !== "string"
    || typeof value.draft.templateVersion !== "string"
    || typeof value.draft.title !== "string"
    || !Array.isArray(value.draft.sections)
    || !Array.isArray(value.candidateClaims)
    || !Array.isArray(value.risks)
    || typeof value.provider !== "string"
    || typeof value.model !== "string"
    || typeof value.promptVersion !== "string"
  ) return undefined;
  if (!value.candidateClaims.every(isCandidateClaim)) return undefined;
  return value as AgentPreparationProposal;
}

function isCandidateClaim(value: unknown): boolean {
  return isRecord(value)
    && typeof value.statement === "string"
    && typeof value.excerpt === "string"
    && typeof value.confidence === "number"
    && typeof value.rationale === "string";
}

export function draftTitleFrom(value: unknown): string | undefined {
  return isRecord(value) && typeof value.title === "string" && value.title.trim().length > 0
    ? value.title
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
