import { desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateHumanRevisionPersistenceRequest,
  CreateHumanRevisionPersistenceResult,
  CurrentBriefingForHumanRevision,
  HumanRevisionRepository,
} from "@/modules/editorial/create-human-revision-command";

import { briefingRevisions, briefings, humanRevisionCreationRecords } from "./schema";

/**
 * Postgres implementation of editor-owned revision creation. Locking the
 * Briefing aggregate serialises sequence allocation and makes the expected
 * current-revision comparison authoritative at commit time.
 */
export class DrizzleHumanRevisionRepository implements HumanRevisionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async retrieveCurrentBriefing(briefingId: string): Promise<CurrentBriefingForHumanRevision | undefined> {
    const [briefing] = await this.db
      .select({ id: briefings.id, status: briefings.status })
      .from(briefings)
      .where(eq(briefings.id, briefingId))
      .limit(1);
    if (!briefing) return undefined;
    const [revision] = await this.db
      .select({ id: briefingRevisions.id })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.briefingId, briefingId))
      .orderBy(desc(briefingRevisions.sequence))
      .limit(1);
    return revision ? { briefingId: briefing.id, status: briefing.status, currentRevisionId: revision.id } : undefined;
  }

  async createHumanRevision(request: CreateHumanRevisionPersistenceRequest): Promise<CreateHumanRevisionPersistenceResult> {
    return this.db.transaction(async (transaction) => {
      // A concurrent replay of the same command must observe one receipt.
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);
      const [existing] = await transaction
        .select({ briefingId: humanRevisionCreationRecords.briefingId, expectedRevisionId: humanRevisionCreationRecords.expectedRevisionId, revisionId: humanRevisionCreationRecords.briefingRevisionId, id: humanRevisionCreationRecords.id })
        .from(humanRevisionCreationRecords)
        .where(eq(humanRevisionCreationRecords.idempotencyKey, request.idempotencyKey))
        .limit(1);
      if (existing) {
        if (existing.briefingId !== request.briefingId || existing.expectedRevisionId !== request.expectedRevisionId) return { kind: "idempotency-conflict" };
        const [revision] = await transaction.select({ sequence: briefingRevisions.sequence }).from(briefingRevisions).where(eq(briefingRevisions.id, existing.revisionId)).limit(1);
        if (!revision) throw new Error("A human revision creation receipt references a missing revision.");
        return { kind: "idempotent", revisionId: existing.revisionId, sequence: revision.sequence, creationRecordId: existing.id };
      }

      // Lock first, then derive the latest revision. Every writer for this
      // command serialises on this aggregate row rather than racing max(seq).
      await transaction.execute(sql`select ${briefings.id} from ${briefings} where ${briefings.id} = ${request.briefingId} for update`);
      const [briefing] = await transaction.select({ id: briefings.id, status: briefings.status }).from(briefings).where(eq(briefings.id, request.briefingId)).limit(1);
      if (!briefing) return { kind: "briefing-not-found" };
      if (briefing.status !== "draft") return { kind: "briefing-not-draft" };

      const [current] = await transaction
        .select({ id: briefingRevisions.id, sequence: briefingRevisions.sequence })
        .from(briefingRevisions)
        .where(eq(briefingRevisions.briefingId, briefing.id))
        .orderBy(desc(briefingRevisions.sequence))
        .limit(1);
      if (!current || current.id !== request.expectedRevisionId) return { kind: "revision-conflict" };

      const occurredAt = timestampFrom(request.occurredAt);
      const [revision] = await transaction.insert(briefingRevisions).values({
        briefingId: briefing.id,
        sequence: current.sequence + 1,
        templateVersion: "v1",
        content: request.content,
        origin: "human",
        createdBy: request.actorId,
        createdAt: occurredAt,
      }).returning({ id: briefingRevisions.id, sequence: briefingRevisions.sequence });
      await transaction.update(briefings).set({ updatedAt: occurredAt }).where(eq(briefings.id, briefing.id));
      const [record] = await transaction.insert(humanRevisionCreationRecords).values({
        idempotencyKey: request.idempotencyKey,
        briefingId: briefing.id,
        expectedRevisionId: current.id,
        briefingRevisionId: revision.id,
        actorId: request.actorId,
        ...(request.note ? { note: request.note } : {}),
        occurredAt,
        createdAt: occurredAt,
      }).returning({ id: humanRevisionCreationRecords.id });
      return { kind: "created", revisionId: revision.id, sequence: revision.sequence, creationRecordId: record.id };
    });
  }
}

function timestampFrom(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Human revision creation contains an invalid timestamp.");
  return date;
}
