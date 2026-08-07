import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateEditorialClaimRepository,
  CreateEditorialClaimRequest,
} from "@/modules/evidence/create-editorial-claim-command";

import {
  acceptedSources,
  briefingRevisions,
  briefings,
  claimSupports,
  claims,
  editorialClaimCreationRecords,
} from "./schema";

/** PostgreSQL implementation of the human-authored Claim command. */
export class DrizzleCreateEditorialClaimRepository implements CreateEditorialClaimRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async create(request: CreateEditorialClaimRequest) {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);

      const [existing] = await transaction
        .select({
          id: editorialClaimCreationRecords.id,
          briefingId: editorialClaimCreationRecords.briefingId,
          briefingRevisionId: editorialClaimCreationRecords.briefingRevisionId,
          acceptedSourceId: editorialClaimCreationRecords.acceptedSourceId,
          claimId: editorialClaimCreationRecords.claimId,
          claimSupportId: editorialClaimCreationRecords.claimSupportId,
        })
        .from(editorialClaimCreationRecords)
        .where(eq(editorialClaimCreationRecords.idempotencyKey, request.idempotencyKey))
        .limit(1);

      if (existing) {
        if (
          existing.briefingId !== request.briefingId
          || existing.briefingRevisionId !== request.briefingRevisionId
          || existing.acceptedSourceId !== request.acceptedSourceId
        ) {
          return { kind: "idempotency-conflict" as const };
        }

        return {
          kind: "idempotent" as const,
          claimId: existing.claimId,
          claimSupportId: existing.claimSupportId,
          recordId: existing.id,
        };
      }

      const [[revision], [source]] = await Promise.all([
        transaction
          .select({
            id: briefingRevisions.id,
            briefingId: briefingRevisions.briefingId,
            status: briefings.status,
          })
          .from(briefingRevisions)
          .innerJoin(briefings, eq(briefings.id, briefingRevisions.briefingId))
          .where(
            and(
              eq(briefingRevisions.id, request.briefingRevisionId),
              eq(briefingRevisions.briefingId, request.briefingId),
            ),
          )
          .limit(1),
        transaction
          .select({ id: acceptedSources.id })
          .from(acceptedSources)
          .where(eq(acceptedSources.id, request.acceptedSourceId))
          .limit(1),
      ]);

      if (!revision || revision.status !== "draft") return { kind: "briefing-conflict" as const };
      if (!source) return { kind: "source-not-found" as const };

      const [currentRevision] = await transaction
        .select({ id: briefingRevisions.id })
        .from(briefingRevisions)
        .where(eq(briefingRevisions.briefingId, request.briefingId))
        .orderBy(desc(briefingRevisions.sequence))
        .limit(1);
      if (currentRevision?.id !== revision.id) return { kind: "briefing-conflict" as const };

      const occurredAt = new Date(request.occurredAt);
      const [claim] = await transaction
        .insert(claims)
        .values({
          briefingRevisionId: revision.id,
          statement: request.claim.statement,
          status: "verified",
          createdBy: request.actorId,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        .returning({ id: claims.id });
      const [support] = await transaction
        .insert(claimSupports)
        .values({
          claimId: claim.id,
          acceptedSourceId: source.id,
          kind: "direct",
          excerpt: request.claim.excerpt,
          rationale: request.claim.rationale,
          addedBy: request.actorId,
          addedAt: occurredAt,
        })
        .returning({ id: claimSupports.id });
      const [record] = await transaction
        .insert(editorialClaimCreationRecords)
        .values({
          idempotencyKey: request.idempotencyKey,
          briefingId: request.briefingId,
          briefingRevisionId: revision.id,
          acceptedSourceId: source.id,
          claimId: claim.id,
          claimSupportId: support.id,
          actorId: request.actorId,
          occurredAt,
        })
        .returning({ id: editorialClaimCreationRecords.id });

      return {
        kind: "created" as const,
        claimId: claim.id,
        claimSupportId: support.id,
        recordId: record.id,
      };
    });
  }
}
