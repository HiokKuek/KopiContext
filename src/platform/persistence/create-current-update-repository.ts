import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { CreateCurrentUpdateRepository, CreateCurrentUpdateRequest } from "@/modules/editorial/create-current-update-command";
import { briefings, currentUpdateCreationRecords, currentUpdates } from "./schema";

export class DrizzleCreateCurrentUpdateRepository implements CreateCurrentUpdateRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async createDraft(request: CreateCurrentUpdateRequest) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);
      const [existing] = await transaction.select({ id: currentUpdateCreationRecords.id, currentUpdateId: currentUpdateCreationRecords.currentUpdateId }).from(currentUpdateCreationRecords).where(eq(currentUpdateCreationRecords.idempotencyKey, request.idempotencyKey)).limit(1);
      if (existing) return { kind: "idempotent" as const, currentUpdateId: existing.currentUpdateId };

      const [briefing] = await transaction.select({ topicId: briefings.topicId }).from(briefings).where(eq(briefings.id, request.briefingId)).limit(1);
      if (!briefing) return { kind: "briefing-not-found" as const };

      const occurredAt = new Date(request.occurredAt);
      const [update] = await transaction.insert(currentUpdates).values({
        topicId: briefing.topicId,
        briefingId: request.briefingId,
        status: "draft",
        title: request.title,
        body: request.body,
        effectiveAt: new Date(request.effectiveAt),
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }).returning({ id: currentUpdates.id });
      await transaction.insert(currentUpdateCreationRecords).values({ idempotencyKey: request.idempotencyKey, currentUpdateId: update.id, actorId: request.actorId, occurredAt });
      return { kind: "created" as const, currentUpdateId: update.id };
    });
  }
}
