import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  fingerprintProposalOutput,
} from "@/modules/editorial/accept-prepared-proposal-command";
import type {
  AcceptSourceFromSubmissionPersistenceRequest,
  AcceptSourceFromSubmissionRepository,
  PreparedSubmissionForSourceAcceptance,
} from "@/modules/evidence/accept-source-from-submission-command";

import { mapPersistedSourcePreparation } from "./source-preparation-repository";
import { acceptedSources, proposalDecisionRecords, sourceSubmissions } from "./schema";

/** Transactional persistence for one explicit Source acceptance. */
export class DrizzleAcceptSourceFromSubmissionRepository implements AcceptSourceFromSubmissionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async retrievePreparedSubmission(submissionId: string): Promise<PreparedSubmissionForSourceAcceptance | undefined> {
    const [row] = await this.db.select().from(sourceSubmissions).where(eq(sourceSubmissions.id, submissionId)).limit(1);
    return row ? proposalSnapshot(row) : undefined;
  }

  async acceptSourceFromSubmission(request: AcceptSourceFromSubmissionPersistenceRequest) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);
      const [existing] = await transaction
        .select({
          part: proposalDecisionRecords.proposalPart,
          submissionId: proposalDecisionRecords.sourceSubmissionId,
          fingerprint: proposalDecisionRecords.proposalOutputFingerprint,
          sourceId: proposalDecisionRecords.acceptedSourceId,
          decisionId: proposalDecisionRecords.id,
        })
        .from(proposalDecisionRecords)
        .where(eq(proposalDecisionRecords.idempotencyKey, request.idempotencyKey))
        .limit(1);
      if (existing) {
        if (existing.part !== "source" || existing.submissionId !== request.submissionId || existing.fingerprint !== request.expectedOutputFingerprint || !existing.sourceId) {
          return { kind: "idempotency-conflict" } as const;
        }
        return { kind: "idempotent", acceptedSourceId: existing.sourceId, decisionId: existing.decisionId } as const;
      }

      await transaction.execute(sql`select ${sourceSubmissions.id} from ${sourceSubmissions} where ${sourceSubmissions.id} = ${request.submissionId} for update`);
      const [submission] = await transaction.select().from(sourceSubmissions).where(eq(sourceSubmissions.id, request.submissionId)).limit(1);
      if (!submission) return { kind: "proposal-conflict" } as const;
      const prepared = proposalSnapshot(submission);
      if (!prepared || (prepared.state !== "prepared" && prepared.state !== "needs-review")) return { kind: "proposal-not-ready" } as const;
      if (prepared.outputFingerprint !== request.expectedOutputFingerprint) return { kind: "proposal-conflict" } as const;

      const [duplicate] = await transaction.select({ id: acceptedSources.id }).from(acceptedSources).where(eq(acceptedSources.canonicalUrl, request.source.canonicalUrl)).limit(1);
      if (duplicate) return { kind: "source-conflict" } as const;

      const acceptedAt = asDate(request.source.acceptedAt);
      const [source] = await transaction.insert(acceptedSources).values({
        acceptedFromSubmissionId: request.source.acceptedFromSubmissionId,
        title: request.source.title,
        publisher: request.source.publisher,
        sourceType: request.source.sourceType,
        canonicalUrl: request.source.canonicalUrl,
        ...(request.source.externalIdentifier ? { externalIdentifier: request.source.externalIdentifier } : {}),
        ...(request.source.publishedAt ? { publishedAt: asDate(request.source.publishedAt) } : {}),
        retrievedAt: asDate(request.source.retrievedAt),
        relation: request.source.relation,
        rightsNote: request.source.rightsNote,
        acceptedBy: request.source.acceptedBy,
        acceptedAt,
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      }).returning({ id: acceptedSources.id });
      const [decision] = await transaction.insert(proposalDecisionRecords).values({
        idempotencyKey: request.idempotencyKey,
        sourceSubmissionId: request.submissionId,
        proposalOutputFingerprint: prepared.outputFingerprint,
        proposalPart: "source",
        outcome: "accepted",
        actorId: request.actorId,
        occurredAt: asDate(request.occurredAt),
        acceptedSourceId: source.id,
        metadata: { canonicalUrl: request.source.canonicalUrl, title: request.source.title },
      }).returning({ id: proposalDecisionRecords.id });
      return { kind: "created", acceptedSourceId: source.id, decisionId: decision.id } as const;
    });
  }
}

function proposalSnapshot(row: typeof sourceSubmissions.$inferSelect): PreparedSubmissionForSourceAcceptance | undefined {
  if (!row.preparationResultState) return undefined;
  const result = mapPersistedSourcePreparation(row);
  if (result.state === "prepared" || result.state === "needs-review") {
    return { submissionId: row.id, state: result.state, outputFingerprint: fingerprintProposalOutput(result.proposal) };
  }
  return { submissionId: row.id, state: result.state };
}
function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Source acceptance contains an invalid timestamp.");
  return date;
}
