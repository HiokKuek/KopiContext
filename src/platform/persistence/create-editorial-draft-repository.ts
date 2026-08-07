import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { CreateEditorialDraftRepository } from "@/modules/editorial/create-editorial-draft-command";
import { briefingRevisions, briefings, editorialDraftCreationRecords, topics } from "./schema";

/** Creates the initial human-owned editorial aggregate atomically. */
export class DrizzleCreateEditorialDraftRepository implements CreateEditorialDraftRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async createDraft(request: Parameters<CreateEditorialDraftRepository["createDraft"]>[0]) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);
      const [existing] = await transaction.select({ topicId: editorialDraftCreationRecords.topicId, briefingId: editorialDraftCreationRecords.briefingId, revisionId: editorialDraftCreationRecords.briefingRevisionId, id: editorialDraftCreationRecords.id }).from(editorialDraftCreationRecords).where(eq(editorialDraftCreationRecords.idempotencyKey, request.idempotencyKey)).limit(1);
      if (existing) return { kind: "idempotent" as const, topicId: existing.topicId, briefingId: existing.briefingId, revisionId: existing.revisionId, creationRecordId: existing.id };

      const at = timestamp(request.occurredAt);
      const [topic] = await transaction.insert(topics).values({ slug: request.topic.slug, title: request.topic.title, description: request.topic.description, status: "active", createdAt: at, updatedAt: at }).onConflictDoNothing({ target: topics.slug }).returning({ id: topics.id });
      if (!topic) return { kind: "topic-conflict" as const };
      const [briefing] = await transaction.insert(briefings).values({ topicId: topic.id, status: "draft", templateVersion: request.revision.templateVersion, createdAt: at, updatedAt: at }).returning({ id: briefings.id });
      const [revision] = await transaction.insert(briefingRevisions).values({ briefingId: briefing.id, sequence: 1, templateVersion: request.revision.templateVersion, content: request.revision.content, origin: "human", createdBy: request.revision.createdBy, createdAt: at }).returning({ id: briefingRevisions.id });
      const [record] = await transaction.insert(editorialDraftCreationRecords).values({ idempotencyKey: request.idempotencyKey, topicId: topic.id, briefingId: briefing.id, briefingRevisionId: revision.id, actorId: request.actorId, occurredAt: at, createdAt: at }).returning({ id: editorialDraftCreationRecords.id });
      return { kind: "created" as const, topicId: topic.id, briefingId: briefing.id, revisionId: revision.id, creationRecordId: record.id };
    });
  }
}

function timestamp(value: string): Date { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error("Editorial Draft creation contains an invalid timestamp."); return date; }
