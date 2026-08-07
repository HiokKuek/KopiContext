import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  EditorialStatus,
  EditorialTransitionSuccess,
} from "@/modules/editorial/editorial-workflow";
import type {
  BriefingSource,
  PublishedBriefing,
} from "@/modules/content/published-briefings";

import {
  acceptedSources,
  briefingRevisions,
  briefings,
  claimSupports,
  claims,
  editorialAuditRecords,
  topics,
} from "./schema";

/**
 * A read port for anonymous-reader content. Only Published Briefings are
 * returned, even if a caller accidentally asks for another editorial state.
 */
export type PublishedCatalogueRepository = Readonly<{
  findPublishedBriefingBySlug(slug: string): Promise<PublishedBriefing | undefined>;
}>;

/**
 * The persistence shape of an already-evaluated workflow state change. The
 * editorial module decides whether a change is legal; this adapter writes the
 * resulting state and append-only audit record in one transaction.
 */
export type EditorialTransitionPersistenceRequest = Readonly<{
  briefingId: string;
  revisionId: string;
  from: EditorialStatus;
  to: EditorialStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
}>;

export type EditorialTransitionRepository = Readonly<{
  persistTransition(
    transition: EditorialTransitionPersistenceRequest,
  ): Promise<"persisted" | "conflict">;
}>;

/** Maps the successful outcome from the editorial application seam to its storage port. */
export function editorialTransitionPersistenceRequest(
  outcome: EditorialTransitionSuccess,
): EditorialTransitionPersistenceRequest {
  return {
    briefingId: outcome.item.id,
    revisionId: outcome.item.revisionId,
    from: outcome.audit.from,
    to: outcome.audit.to,
    actorId: outcome.audit.actorId,
    ...(outcome.audit.reason ? { reason: outcome.audit.reason } : {}),
    occurredAt: outcome.audit.occurredAt,
  };
}

type BriefingTemplateContent = Omit<
  PublishedBriefing,
  "slug" | "title" | "status" | "templateVersion" | "sources" | "lastReviewedAt"
>;

export type PublishedBriefingDatabaseRecord = Readonly<{
  slug: string;
  title: string;
  templateVersion: string;
  content: unknown;
  publishedAt: Date;
  sources: ReadonlyArray<BriefingSource>;
}>;

/**
 * Converts one published database aggregate into the public content contract.
 * Invalid or outdated template JSON is deliberately not exposed to readers.
 */
export function mapPublishedBriefing(
  record: PublishedBriefingDatabaseRecord,
): PublishedBriefing | undefined {
  if (record.templateVersion !== "v1") {
    return undefined;
  }

  const content = asBriefingTemplateContent(record.content);
  if (!content) {
    return undefined;
  }

  return {
    slug: record.slug,
    title: record.title,
    status: "published",
    templateVersion: "v1",
    ...content,
    sources: uniqueSources(record.sources),
    lastReviewedAt: record.publishedAt.toISOString().slice(0, 10),
  };
}

/** Drizzle implementation of the public catalogue read port. */
export class DrizzlePublishedCatalogueRepository implements PublishedCatalogueRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findPublishedBriefingBySlug(slug: string): Promise<PublishedBriefing | undefined> {
    if (slug.trim().length === 0) {
      return undefined;
    }

    const [briefing] = await this.db
      .select({
        briefingId: briefings.id,
        slug: topics.slug,
        title: topics.title,
        templateVersion: briefings.templateVersion,
      })
      .from(briefings)
      .innerJoin(topics, eq(topics.id, briefings.topicId))
      .where(and(eq(topics.slug, slug), eq(briefings.status, "published")))
      .limit(1);

    if (!briefing) {
      return undefined;
    }

    // A publication audit identifies the exact immutable revision readers see.
    const [publication] = await this.db
      .select({ revisionId: editorialAuditRecords.briefingRevisionId, occurredAt: editorialAuditRecords.occurredAt })
      .from(editorialAuditRecords)
      .where(
        and(
          eq(editorialAuditRecords.briefingId, briefing.briefingId),
          eq(editorialAuditRecords.toStatus, "published"),
        ),
      )
      .orderBy(desc(editorialAuditRecords.occurredAt))
      .limit(1);

    if (!publication) {
      return undefined;
    }

    const [revision] = await this.db
      .select({ content: briefingRevisions.content })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.id, publication.revisionId))
      .limit(1);

    if (!revision) {
      return undefined;
    }

    const sourceRows = await this.db
      .select({
        title: acceptedSources.title,
        publisher: acceptedSources.publisher,
        url: acceptedSources.canonicalUrl,
      })
      .from(claims)
      .innerJoin(claimSupports, eq(claimSupports.claimId, claims.id))
      .innerJoin(acceptedSources, eq(acceptedSources.id, claimSupports.acceptedSourceId))
      .where(eq(claims.briefingRevisionId, publication.revisionId));

    return mapPublishedBriefing({
      slug: briefing.slug,
      title: briefing.title,
      templateVersion: briefing.templateVersion,
      content: revision.content,
      publishedAt: publication.occurredAt,
      sources: sourceRows,
    });
  }
}

/** Drizzle implementation of atomic editorial state-and-audit persistence. */
export class DrizzleEditorialTransitionRepository implements EditorialTransitionRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async persistTransition(
    transition: EditorialTransitionPersistenceRequest,
  ): Promise<"persisted" | "conflict"> {
    const occurredAt = new Date(transition.occurredAt);

    return this.db.transaction(async (transaction) => {
      // The audit revision must belong to the Briefing whose state is changing.
      const [revision] = await transaction
        .select({ id: briefingRevisions.id })
        .from(briefingRevisions)
        .where(
          and(
            eq(briefingRevisions.id, transition.revisionId),
            eq(briefingRevisions.briefingId, transition.briefingId),
          ),
        )
        .limit(1);

      if (!revision) {
        return "conflict" as const;
      }

      // Comparing the prior state makes stale workflow evaluations harmless.
      const updated = await transaction
        .update(briefings)
        .set({ status: transition.to, updatedAt: occurredAt })
        .where(
          and(eq(briefings.id, transition.briefingId), eq(briefings.status, transition.from)),
        )
        .returning({ id: briefings.id });

      if (updated.length !== 1) {
        return "conflict" as const;
      }

      await transaction.insert(editorialAuditRecords).values({
        briefingId: transition.briefingId,
        briefingRevisionId: transition.revisionId,
        fromStatus: transition.from,
        toStatus: transition.to,
        actorId: transition.actorId,
        ...(transition.reason ? { reason: transition.reason } : {}),
        occurredAt,
      });

      return "persisted" as const;
    });
  }
}

function asBriefingTemplateContent(value: unknown): BriefingTemplateContent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const oneSentenceExplanation = value.oneSentenceExplanation;
  const thirtySecondOverview = value.thirtySecondOverview;
  const fiveMinuteExplanation = value.fiveMinuteExplanation;
  const whyPeopleCare = value.whyPeopleCare;
  const singaporeSeaAngle = value.singaporeSeaAngle;

  if (
    typeof oneSentenceExplanation !== "string" ||
    typeof thirtySecondOverview !== "string" ||
    typeof fiveMinuteExplanation !== "string" ||
    typeof whyPeopleCare !== "string" ||
    typeof singaporeSeaAngle !== "string"
  ) {
    return undefined;
  }

  if (
    !isStringArray(value.entities) ||
    !isStringArray(value.debates) ||
    !isStringArray(value.questionsToAsk) ||
    !isStringArray(value.mistakesToAvoid) ||
    !isKeyTermArray(value.keyTerms)
  ) {
    return undefined;
  }

  return {
    oneSentenceExplanation,
    thirtySecondOverview,
    fiveMinuteExplanation,
    whyPeopleCare,
    keyTerms: value.keyTerms,
    entities: value.entities,
    debates: value.debates,
    singaporeSeaAngle,
    questionsToAsk: value.questionsToAsk,
    mistakesToAvoid: value.mistakesToAvoid,
  };
}

function uniqueSources(sources: ReadonlyArray<BriefingSource>): ReadonlyArray<BriefingSource> {
  const sourcesByUrl = new Map<string, BriefingSource>();
  for (const source of sources) {
    sourcesByUrl.set(source.url, source);
  }
  return [...sourcesByUrl.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isKeyTermArray(
  value: unknown,
): value is ReadonlyArray<{ term: string; definition: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => isRecord(item) && typeof item.term === "string" && typeof item.definition === "string",
    )
  );
}
