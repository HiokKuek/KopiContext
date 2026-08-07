import { and, asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  EditorialAuditRecord,
  EditorialItem,
  EditorialStatus,
  EditorialTransitionOutcome,
  EditorialTransitionSuccess,
} from "@/modules/editorial/editorial-workflow";
import {
  EditorialTransitionConflictError,
  type EditorialRepository,
  type EditorialRevision,
} from "../../modules/editorial/editorial-repository";
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
      // The audit revision must be both owned by, and still the newest revision
      // of, the Briefing whose state is changing. This makes a command evaluated
      // against an earlier draft a conflict instead of an audit on new content.
      const [revision] = await transaction
        .select({ id: briefingRevisions.id })
        .from(briefingRevisions)
        .where(eq(briefingRevisions.briefingId, transition.briefingId))
        .orderBy(desc(briefingRevisions.sequence))
        .limit(1);

      if (!revision || revision.id !== transition.revisionId) {
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

/**
 * Drizzle adapter for the Editorial Workflow's richer repository port. It
 * keeps template interpretation at the persistence boundary, so the editorial
 * domain receives only the facts it needs to make a transition decision.
 */
export class DrizzleEditorialRepository implements EditorialRepository {
  private readonly transitions: DrizzleEditorialTransitionRepository;

  constructor(private readonly db: NodePgDatabase) {
    this.transitions = new DrizzleEditorialTransitionRepository(db);
  }

  async retrieveById(id: string): Promise<EditorialItem | undefined> {
    const [briefing] = await this.db
      .select({ id: briefings.id, status: briefings.status })
      .from(briefings)
      .where(eq(briefings.id, id))
      .limit(1);
    if (!briefing) return undefined;

    const [revision] = await this.db
      .select({
        id: briefingRevisions.id,
        templateVersion: briefingRevisions.templateVersion,
        content: briefingRevisions.content,
      })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.briefingId, briefing.id))
      .orderBy(desc(briefingRevisions.sequence))
      .limit(1);
    if (!revision) return undefined;

    const claimRows = await this.db
      .select({
        claimId: claims.id,
        supportId: claimSupports.id,
        acceptedSourceId: acceptedSources.id,
      })
      .from(claims)
      .leftJoin(claimSupports, eq(claimSupports.claimId, claims.id))
      .leftJoin(acceptedSources, eq(acceptedSources.id, claimSupports.acceptedSourceId))
      .where(eq(claims.briefingRevisionId, revision.id));

    return mapEditorialItem({
      id: briefing.id,
      status: briefing.status,
      revisionId: revision.id,
      templateVersion: revision.templateVersion,
      content: revision.content,
      claimRows,
    });
  }

  async persistTransition(outcome: EditorialTransitionOutcome): Promise<void> {
    if (!outcome.ok) return;

    const result = await this.transitions.persistTransition(
      editorialTransitionPersistenceRequest(outcome),
    );
    if (result === "conflict") {
      throw new EditorialTransitionConflictError(
        `Cannot transition editorial item ${outcome.item.id}: the persisted item or revision changed after evaluation.`,
      );
    }
  }

  async retrieveRevisionById(id: string): Promise<EditorialRevision | undefined> {
    const [revision] = await this.db
      .select({
        id: briefingRevisions.id,
        itemId: briefingRevisions.briefingId,
        sequence: briefingRevisions.sequence,
        templateVersion: briefingRevisions.templateVersion,
        content: briefingRevisions.content,
        createdAt: briefingRevisions.createdAt,
      })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.id, id))
      .limit(1);

    return revision ? mapEditorialRevision(revision) : undefined;
  }

  async listRevisions(itemId: string): Promise<ReadonlyArray<EditorialRevision>> {
    const revisions = await this.db
      .select({
        id: briefingRevisions.id,
        itemId: briefingRevisions.briefingId,
        sequence: briefingRevisions.sequence,
        templateVersion: briefingRevisions.templateVersion,
        content: briefingRevisions.content,
        createdAt: briefingRevisions.createdAt,
      })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.briefingId, itemId))
      .orderBy(asc(briefingRevisions.sequence));

    return revisions.map(mapEditorialRevision);
  }

  async listAuditRecords(itemId: string): Promise<ReadonlyArray<EditorialAuditRecord>> {
    const records = await this.db
      .select({
        itemId: editorialAuditRecords.briefingId,
        revisionId: editorialAuditRecords.briefingRevisionId,
        from: editorialAuditRecords.fromStatus,
        to: editorialAuditRecords.toStatus,
        actorId: editorialAuditRecords.actorId,
        reason: editorialAuditRecords.reason,
        occurredAt: editorialAuditRecords.occurredAt,
      })
      .from(editorialAuditRecords)
      .where(eq(editorialAuditRecords.briefingId, itemId))
      .orderBy(asc(editorialAuditRecords.occurredAt));

    return records.map(mapEditorialAuditRecord);
  }
}

export type EditorialItemDatabaseRecord = Readonly<{
  id: string;
  status: EditorialStatus;
  revisionId: string;
  templateVersion: string;
  content: unknown;
  claimRows: ReadonlyArray<Readonly<{
    claimId: string;
    supportId: string | null;
    acceptedSourceId: string | null;
  }>>;
}>;

/** Maps a normalised Briefing/revision/claim aggregate to the workflow port. */
export function mapEditorialItem(record: EditorialItemDatabaseRecord): EditorialItem {
  const claimsById = new Map<string, boolean>();
  const acceptedSourceIds = new Set<string>();

  for (const claim of record.claimRows) {
    const hasAcceptedSupport = claim.supportId !== null && claim.acceptedSourceId !== null;
    claimsById.set(claim.claimId, (claimsById.get(claim.claimId) ?? false) || hasAcceptedSupport);
    if (claim.acceptedSourceId) acceptedSourceIds.add(claim.acceptedSourceId);
  }

  return {
    id: record.id,
    status: record.status,
    revisionId: record.revisionId,
    template: { isComplete: isCompleteBriefingTemplate(record.templateVersion, record.content) },
    acceptedSources: [...acceptedSourceIds].map((id) => ({ id })),
    claims: [...claimsById].map(([id, isSupported]) => ({ id, isSupported })),
  };
}

type EditorialRevisionDatabaseRecord = Readonly<{
  id: string;
  itemId: string;
  sequence: number;
  templateVersion: string;
  content: unknown;
  createdAt: Date;
}>;

/** Converts immutable database JSON into a defensive Editorial Revision value. */
export function mapEditorialRevision(record: EditorialRevisionDatabaseRecord): EditorialRevision {
  if (!isRecord(record.content)) {
    throw new Error(`Briefing revision ${record.id} has invalid non-object template content.`);
  }

  return {
    id: record.id,
    itemId: record.itemId,
    sequence: record.sequence,
    templateVersion: record.templateVersion,
    content: structuredClone(record.content),
    createdAt: record.createdAt.toISOString(),
  };
}

type EditorialAuditDatabaseRecord = Readonly<{
  itemId: string;
  revisionId: string;
  from: EditorialStatus;
  to: EditorialStatus;
  actorId: string;
  reason: string | null;
  occurredAt: Date;
}>;

/** Converts storage nullability into the workflow's optional audit reason. */
export function mapEditorialAuditRecord(record: EditorialAuditDatabaseRecord): EditorialAuditRecord {
  return {
    itemId: record.itemId,
    revisionId: record.revisionId,
    from: record.from,
    to: record.to,
    actorId: record.actorId,
    ...(record.reason === null ? {} : { reason: record.reason }),
    occurredAt: record.occurredAt.toISOString(),
  };
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

/**
 * Editorial publication needs a binary answer rather than public rendering.
 * Keep that answer aligned with the versioned template validator used by the
 * reader, while treating unrecognised template versions as incomplete.
 */
export function isCompleteBriefingTemplate(templateVersion: string, content: unknown): boolean {
  return templateVersion === "v1" && asBriefingTemplateContent(content) !== undefined;
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
