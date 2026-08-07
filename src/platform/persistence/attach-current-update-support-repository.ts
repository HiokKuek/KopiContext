import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  AttachCurrentUpdateSupportRepository,
  AttachCurrentUpdateSupportRequest,
} from "@/modules/evidence/attach-current-update-support-command";

import {
  acceptedSources,
  currentUpdateSupportAcceptanceRecords,
  currentUpdateSupports,
  currentUpdates,
} from "./schema";

/** PostgreSQL implementation of adding reviewed evidence to a draft update. */
export class DrizzleAttachCurrentUpdateSupportRepository
  implements AttachCurrentUpdateSupportRepository
{
  constructor(private readonly db: NodePgDatabase) {}

  async attach(request: AttachCurrentUpdateSupportRequest) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);

      const [existing] = await transaction
        .select({
          currentUpdateId: currentUpdateSupportAcceptanceRecords.currentUpdateId,
          acceptedSourceId: currentUpdateSupportAcceptanceRecords.acceptedSourceId,
          supportId: currentUpdateSupportAcceptanceRecords.currentUpdateSupportId,
        })
        .from(currentUpdateSupportAcceptanceRecords)
        .where(eq(currentUpdateSupportAcceptanceRecords.idempotencyKey, request.idempotencyKey))
        .limit(1);

      if (existing) {
        if (
          existing.currentUpdateId !== request.currentUpdateId
          || existing.acceptedSourceId !== request.acceptedSourceId
        ) {
          return { kind: "idempotency-conflict" as const };
        }
        return { kind: "idempotent" as const, supportId: existing.supportId };
      }

      const [[update], [source]] = await Promise.all([
        transaction
          .select({ id: currentUpdates.id, status: currentUpdates.status })
          .from(currentUpdates)
          .where(eq(currentUpdates.id, request.currentUpdateId))
          .limit(1),
        transaction
          .select({ id: acceptedSources.id })
          .from(acceptedSources)
          .where(eq(acceptedSources.id, request.acceptedSourceId))
          .limit(1),
      ]);

      if (!update || update.status !== "draft") return { kind: "update-conflict" as const };
      if (!source) return { kind: "source-not-found" as const };

      const occurredAt = new Date(request.occurredAt);
      const [support] = await transaction
        .insert(currentUpdateSupports)
        .values({
          currentUpdateId: update.id,
          acceptedSourceId: source.id,
          excerpt: request.excerpt,
          rationale: request.rationale,
          addedBy: request.actorId,
          addedAt: occurredAt,
        })
        .onConflictDoNothing({
          target: [currentUpdateSupports.currentUpdateId, currentUpdateSupports.acceptedSourceId],
        })
        .returning({ id: currentUpdateSupports.id });

      const supportId = support?.id ?? (await transaction
        .select({ id: currentUpdateSupports.id })
        .from(currentUpdateSupports)
        .where(
          and(
            eq(currentUpdateSupports.currentUpdateId, update.id),
            eq(currentUpdateSupports.acceptedSourceId, source.id),
          ),
        )
        .limit(1))[0]?.id;
      if (!supportId) return { kind: "update-conflict" as const };

      await transaction.insert(currentUpdateSupportAcceptanceRecords).values({
        idempotencyKey: request.idempotencyKey,
        currentUpdateId: update.id,
        acceptedSourceId: source.id,
        currentUpdateSupportId: supportId,
        actorId: request.actorId,
        occurredAt,
      });
      return { kind: "created" as const, supportId };
    });
  }
}
