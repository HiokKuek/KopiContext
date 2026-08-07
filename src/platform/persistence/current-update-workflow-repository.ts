import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { CurrentUpdateWorkflowRepository } from "@/modules/editorial/current-update-workflow-command";

import {
  currentUpdateAuditRecords,
  currentUpdateSupports,
  currentUpdates,
} from "./schema";

/** PostgreSQL persistence for an atomic Current Update state-and-audit pair. */
export class DrizzleCurrentUpdateWorkflowRepository
  implements CurrentUpdateWorkflowRepository
{
  constructor(private readonly db: NodePgDatabase) {}

  async retrieve(id: string) {
    const [[update], [support]] = await Promise.all([
      this.db
        .select({ id: currentUpdates.id, status: currentUpdates.status })
        .from(currentUpdates)
        .where(eq(currentUpdates.id, id))
        .limit(1),
      this.db
        .select({ id: currentUpdateSupports.id })
        .from(currentUpdateSupports)
        .where(eq(currentUpdateSupports.currentUpdateId, id))
        .limit(1),
    ]);
    return update ? { ...update, hasAcceptedSource: support !== undefined } : undefined;
  }

  async persist(input: Parameters<CurrentUpdateWorkflowRepository["persist"]>[0]) {
    const occurredAt = new Date(input.occurredAt);
    return this.db.transaction(async (transaction) => {
      const publishedFields = input.to === "published"
        ? { publishedAt: occurredAt }
        : input.to === "approved"
          ? { approvedBy: input.actorId, approvedAt: occurredAt }
          : input.to === "draft" || input.to === "needs-verification"
            ? { approvedBy: null, approvedAt: null }
            : {};
      const updated = await transaction
        .update(currentUpdates)
        .set({ status: input.to, updatedAt: occurredAt, ...publishedFields })
        .where(and(eq(currentUpdates.id, input.currentUpdateId), eq(currentUpdates.status, input.from)))
        .returning({ id: currentUpdates.id });
      if (updated.length !== 1) return "conflict" as const;

      await transaction.insert(currentUpdateAuditRecords).values({
        currentUpdateId: input.currentUpdateId,
        fromStatus: input.from,
        toStatus: input.to,
        actorId: input.actorId,
        ...(input.reason ? { reason: input.reason } : {}),
        occurredAt,
      });
      return "persisted" as const;
    });
  }
}
