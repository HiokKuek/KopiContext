import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  fingerprintProposalOutput,
  type AcceptPreparedProposalPersistenceRequest,
  type AcceptPreparedProposalRepository,
  type AcceptedPreparedProposal,
  type PreparedProposalForEditorialDecision,
} from "@/modules/editorial/accept-prepared-proposal-command";

import { mapPersistedSourcePreparation } from "./source-preparation-repository";
import {
  briefingRevisions,
  briefings,
  proposalDecisionRecords,
  sourceSubmissions,
  topics,
} from "./schema";

/**
 * Persistence adapter for Phase A proposal acceptance. It is deliberately
 * narrower than a CMS: one prepared Submission can create one new Topic,
 * Draft Briefing, agent-origin revision, and append-only decision record.
 */
export class DrizzleAcceptPreparedProposalRepository implements AcceptPreparedProposalRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async retrievePreparedProposal(
    submissionId: string,
  ): Promise<PreparedProposalForEditorialDecision | undefined> {
    const [row] = await this.db
      .select()
      .from(sourceSubmissions)
      .where(eq(sourceSubmissions.id, submissionId))
      .limit(1);
    return row ? mapProposalSnapshot(row) : undefined;
  }

  async acceptPreparedProposal(
    request: AcceptPreparedProposalPersistenceRequest,
  ): Promise<AcceptedPreparedProposal | { kind: "proposal-conflict" | "topic-conflict" | "idempotency-conflict" | "proposal-not-ready" }> {
    return this.db.transaction(async (transaction) => {
      // Serialise replays of the same durable command before allocating any
      // Topic/Briefing rows. This makes a retry return one stable outcome.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`,
      );

      const [existing] = await transaction
        .select({
          submissionId: proposalDecisionRecords.sourceSubmissionId,
          outputFingerprint: proposalDecisionRecords.proposalOutputFingerprint,
          topicId: proposalDecisionRecords.topicId,
          briefingId: proposalDecisionRecords.briefingId,
          revisionId: proposalDecisionRecords.briefingRevisionId,
          decisionId: proposalDecisionRecords.id,
        })
        .from(proposalDecisionRecords)
        .where(eq(proposalDecisionRecords.idempotencyKey, request.idempotencyKey))
        .limit(1);
      if (existing) {
        if (
          existing.submissionId !== request.submissionId ||
          existing.outputFingerprint !== request.expectedOutputFingerprint ||
          !existing.topicId ||
          !existing.briefingId ||
          !existing.revisionId
        ) {
          return { kind: "idempotency-conflict" };
        }
        return {
          kind: "idempotent",
          topicId: existing.topicId,
          briefingId: existing.briefingId,
          revisionId: existing.revisionId,
          decisionId: existing.decisionId,
        };
      }

      // The locked source row is the authoritative proposal snapshot. It is
      // independently compared with the command that was evaluated in memory.
      await transaction.execute(
        sql`select ${sourceSubmissions.id} from ${sourceSubmissions} where ${sourceSubmissions.id} = ${request.submissionId} for update`,
      );
      const [sourceSubmission] = await transaction
        .select()
        .from(sourceSubmissions)
        .where(eq(sourceSubmissions.id, request.submissionId))
        .limit(1);
      if (!sourceSubmission) return { kind: "proposal-conflict" };

      const prepared = mapProposalSnapshot(sourceSubmission);
      if (!prepared || (prepared.state !== "prepared" && prepared.state !== "needs-review")) {
        return { kind: "proposal-not-ready" };
      }
      if (
        prepared.outputFingerprint !== request.expectedOutputFingerprint ||
        request.topic.title !== prepared.proposal.classification.proposedTopic ||
        request.revision.templateVersion !== prepared.proposal.draft.templateVersion ||
        JSON.stringify(request.revision.generationOutput) !== JSON.stringify(prepared.proposal)
      ) {
        return { kind: "proposal-conflict" };
      }

      const occurredAt = asDate(request.occurredAt);
      const [topic] = await transaction
        .insert(topics)
        .values({
          slug: request.topic.slug,
          title: request.topic.title,
          description: request.topic.description,
          status: "active",
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        .onConflictDoNothing({ target: topics.slug })
        .returning({ id: topics.id });
      if (!topic) return { kind: "topic-conflict" };

      const [briefing] = await transaction
        .insert(briefings)
        .values({
          topicId: topic.id,
          status: "draft",
          templateVersion: request.revision.templateVersion,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        .returning({ id: briefings.id });

      const [revision] = await transaction
        .insert(briefingRevisions)
        .values({
          briefingId: briefing.id,
          sequence: 1,
          templateVersion: request.revision.templateVersion,
          content: request.revision.content,
          origin: "agent",
          createdBy: request.revision.createdBy,
          sourceSubmissionId: request.submissionId,
          aiProvider: request.revision.aiProvider,
          aiModel: request.revision.aiModel,
          promptVersion: request.revision.promptVersion,
          inputProvenance: sourceSubmission.processorInputProvenance,
          generationOutput: request.revision.generationOutput,
          createdAt: occurredAt,
        })
        .returning({ id: briefingRevisions.id });

      const [decision] = await transaction
        .insert(proposalDecisionRecords)
        .values({
          idempotencyKey: request.idempotencyKey,
          sourceSubmissionId: request.submissionId,
          proposalOutputFingerprint: prepared.outputFingerprint,
          proposalPart: "classification-and-draft",
          outcome: "accepted",
          actorId: request.actorId,
          occurredAt,
          topicId: topic.id,
          briefingId: briefing.id,
          briefingRevisionId: revision.id,
          metadata: {
            classification: prepared.proposal.classification,
            draftTitle: prepared.proposal.draft.title,
            templateVersion: prepared.proposal.draft.templateVersion,
          },
        })
        .returning({ id: proposalDecisionRecords.id });

      return {
        kind: "created",
        topicId: topic.id,
        briefingId: briefing.id,
        revisionId: revision.id,
        decisionId: decision.id,
      };
    });
  }
}

function mapProposalSnapshot(
  row: typeof sourceSubmissions.$inferSelect,
): PreparedProposalForEditorialDecision | undefined {
  if (!row.preparationResultState) return undefined;
  const result = mapPersistedSourcePreparation(row);
  if (result.state === "prepared" || result.state === "needs-review") {
    return {
      submissionId: result.provenance.submission.id,
      state: result.state,
      proposal: result.proposal,
      outputFingerprint: fingerprintProposalOutput(result.proposal),
    };
  }
  return { submissionId: row.id, state: result.state };
}

function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Proposal acceptance contains an invalid timestamp.");
  return date;
}
