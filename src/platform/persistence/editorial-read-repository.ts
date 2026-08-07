import { asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  allowedEditorialWorkflowActions,
  assessTemplateSections,
  freshnessFrom,
  type EditorialBriefingReview,
  type EditorialClaim,
  type EditorialEvidenceSource,
  type EditorialReadRepository,
  type EditorialSourceSubmissionProvenance,
  type EditorialWorkItem,
  type EditorialWorkQueue,
} from "@/modules/editorial/editorial-read-model";
import type { EditorialAuditRecord, EditorialItem, EditorialStatus } from "@/modules/editorial/editorial-workflow";

import {
  acceptedSources,
  briefingRevisions,
  briefings,
  claimSupports,
  claims,
  editorialAuditRecords,
  sourceSubmissions,
  topics,
} from "./schema";
import { isCompleteBriefingTemplate, mapEditorialAuditRecord } from "./content-repositories";

export type EditorialReadRepositoryOptions = Readonly<{
  now?: () => Date;
  staleAfterDays?: number;
}>;

type RevisionRow = Readonly<{
  id: string;
  briefingId: string;
  sequence: number;
  templateVersion: string;
  content: unknown;
  origin: "human" | "agent";
  createdBy: string;
  createdAt: Date;
}>;

/**
 * Drizzle implementation of editor-only query models. Its public surface has
 * no anonymous-reader method; `DrizzlePublishedCatalogueRepository` remains
 * the separate and status-gated public boundary.
 */
export class DrizzleEditorialReadRepository implements EditorialReadRepository {
  private readonly now: () => Date;
  private readonly staleAfterDays: number;

  constructor(
    private readonly db: NodePgDatabase,
    options: EditorialReadRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.staleAfterDays = options.staleAfterDays ?? 180;
  }

  async listEditorialWork(): Promise<EditorialWorkQueue> {
    const briefingRows = await this.db
      .select({
        id: briefings.id,
        status: briefings.status,
        title: topics.title,
      })
      .from(briefings)
      .innerJoin(topics, eq(topics.id, briefings.topicId));

    const items = (await Promise.all(briefingRows.map((briefing) => this.workItemFor(briefing)))).filter(
      (item): item is EditorialWorkItem => item !== undefined,
    );
    items.sort(compareEditorialWork);

    const countsByStatus: Record<EditorialStatus, number> = {
      draft: 0,
      "needs-verification": 0,
      "in-editorial-review": 0,
      approved: 0,
      published: 0,
      archived: 0,
    };
    for (const item of items) countsByStatus[item.status] += 1;
    return { countsByStatus, items };
  }

  async getEditorialBriefing(briefingId: string): Promise<EditorialBriefingReview | undefined> {
    if (briefingId.trim().length === 0) return undefined;
    const [briefing] = await this.db
      .select({
        id: briefings.id,
        status: briefings.status,
        topicId: topics.id,
        topicSlug: topics.slug,
        topicTitle: topics.title,
      })
      .from(briefings)
      .innerJoin(topics, eq(topics.id, briefings.topicId))
      .where(eq(briefings.id, briefingId))
      .limit(1);
    if (!briefing) return undefined;

    const revision = await this.latestRevision(briefing.id);
    if (!revision || !isRecord(revision.content)) return undefined;

    const [claimRows, auditRecords] = await Promise.all([
      this.claimRowsFor(revision.id),
      this.auditRecordsFor(briefing.id),
    ]);
    const { claims: reviewClaims, sources } = mapReviewEvidence(claimRows);
    const lastActivityAt = latestActivity(revision.createdAt, auditRecords);
    const templateSections = assessTemplateSections(revision.templateVersion, revision.content);
    const item: EditorialItem = {
      id: briefing.id,
      status: briefing.status,
      revisionId: revision.id,
      template: { isComplete: isCompleteBriefingTemplate(revision.templateVersion, revision.content) },
      acceptedSources: sources.map((source) => ({ id: source.id })),
      claims: reviewClaims.map((claim) => ({ id: claim.id, isSupported: claim.supports.length > 0 })),
    };

    return {
      briefing: {
        id: briefing.id,
        title: briefing.topicTitle,
        topic: { id: briefing.topicId, slug: briefing.topicSlug, title: briefing.topicTitle },
        status: briefing.status,
      },
      revision: {
        id: revision.id,
        sequence: revision.sequence,
        templateVersion: revision.templateVersion,
        content: structuredClone(revision.content),
        origin: revision.origin,
        createdBy: revision.createdBy,
        createdAt: revision.createdAt.toISOString(),
      },
      templateSections,
      claims: reviewClaims,
      acceptedSources: sources,
      freshness: freshnessFrom(lastActivityAt, this.now(), this.staleAfterDays),
      auditRecords,
      allowedActions: allowedEditorialWorkflowActions(item),
    };
  }

  private async workItemFor(briefing: { id: string; status: EditorialStatus; title: string }): Promise<EditorialWorkItem | undefined> {
    const revision = await this.latestRevision(briefing.id);
    if (!revision) return undefined;
    const [claimRows, auditRecords] = await Promise.all([
      this.claimRowsFor(revision.id),
      this.auditRecordsFor(briefing.id),
    ]);
    const { claims: reviewClaims, sources } = mapReviewEvidence(claimRows);
    const sections = assessTemplateSections(revision.templateVersion, revision.content);
    return {
      briefingId: briefing.id,
      title: briefing.title,
      topicTitle: briefing.title,
      status: briefing.status,
      revisionId: revision.id,
      revisionCreatedAt: revision.createdAt.toISOString(),
      freshness: freshnessFrom(latestActivity(revision.createdAt, auditRecords), this.now(), this.staleAfterDays),
      completeness: {
        isComplete: isCompleteBriefingTemplate(revision.templateVersion, revision.content),
        missingSectionCount: sections.filter((section) => section.state === "missing").length,
        claimCount: reviewClaims.length,
        unsupportedClaimCount: reviewClaims.filter((claim) => claim.supports.length === 0).length,
        acceptedSourceCount: sources.length,
      },
    };
  }

  private async latestRevision(briefingId: string): Promise<RevisionRow | undefined> {
    const [revision] = await this.db
      .select({
        id: briefingRevisions.id,
        briefingId: briefingRevisions.briefingId,
        sequence: briefingRevisions.sequence,
        templateVersion: briefingRevisions.templateVersion,
        content: briefingRevisions.content,
        origin: briefingRevisions.origin,
        createdBy: briefingRevisions.createdBy,
        createdAt: briefingRevisions.createdAt,
      })
      .from(briefingRevisions)
      .where(eq(briefingRevisions.briefingId, briefingId))
      .orderBy(desc(briefingRevisions.sequence))
      .limit(1);
    return revision;
  }

  private async auditRecordsFor(briefingId: string): Promise<ReadonlyArray<EditorialAuditRecord>> {
    const rows = await this.db
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
      .where(eq(editorialAuditRecords.briefingId, briefingId))
      .orderBy(desc(editorialAuditRecords.occurredAt));
    return rows.map(mapEditorialAuditRecord);
  }

  private async claimRowsFor(revisionId: string): Promise<ReadonlyArray<ClaimEvidenceRow>> {
    return this.db
      .select({
        claimId: claims.id,
        statement: claims.statement,
        claimStatus: claims.status,
        supportId: claimSupports.id,
        supportKind: claimSupports.kind,
        locator: claimSupports.locator,
        excerpt: claimSupports.excerpt,
        rationale: claimSupports.rationale,
        supportAddedBy: claimSupports.addedBy,
        supportAddedAt: claimSupports.addedAt,
        sourceId: acceptedSources.id,
        sourceTitle: acceptedSources.title,
        sourcePublisher: acceptedSources.publisher,
        sourceType: acceptedSources.sourceType,
        canonicalUrl: acceptedSources.canonicalUrl,
        externalIdentifier: acceptedSources.externalIdentifier,
        sourcePublishedAt: acceptedSources.publishedAt,
        sourceRetrievedAt: acceptedSources.retrievedAt,
        sourceRelation: acceptedSources.relation,
        sourceRightsNote: acceptedSources.rightsNote,
        acceptedBy: acceptedSources.acceptedBy,
        acceptedAt: acceptedSources.acceptedAt,
        submissionId: sourceSubmissions.id,
        submissionKind: sourceSubmissions.kind,
        originalIdentifier: sourceSubmissions.originalIdentifier,
        originalUrl: sourceSubmissions.originalUrl,
        submittedBy: sourceSubmissions.submittedBy,
        submittedAt: sourceSubmissions.submittedAt,
        submissionRetrievedAt: sourceSubmissions.retrievedAt,
        submissionRightsNote: sourceSubmissions.rightsNote,
        processingStatus: sourceSubmissions.processingStatus,
        proposedTopic: topics.title,
        proposedSubtopic: sourceSubmissions.proposedSubtopic,
        classificationConfidence: sourceSubmissions.classificationConfidence,
        classificationRationale: sourceSubmissions.classificationRationale,
      })
      .from(claims)
      .leftJoin(claimSupports, eq(claimSupports.claimId, claims.id))
      .leftJoin(acceptedSources, eq(acceptedSources.id, claimSupports.acceptedSourceId))
      .leftJoin(sourceSubmissions, eq(sourceSubmissions.id, acceptedSources.acceptedFromSubmissionId))
      .leftJoin(topics, eq(topics.id, sourceSubmissions.proposedTopicId))
      .where(eq(claims.briefingRevisionId, revisionId))
      .orderBy(asc(claims.createdAt), asc(claimSupports.addedAt));
  }
}

type ClaimEvidenceRow = Readonly<{
  claimId: string;
  statement: string;
  claimStatus: "candidate" | "verified" | "rejected";
  supportId: string | null;
  supportKind: "direct" | "contextual" | null;
  locator: string | null;
  excerpt: string | null;
  rationale: string | null;
  supportAddedBy: string | null;
  supportAddedAt: Date | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourcePublisher: string | null;
  sourceType: string | null;
  canonicalUrl: string | null;
  externalIdentifier: string | null;
  sourcePublishedAt: Date | null;
  sourceRetrievedAt: Date | null;
  sourceRelation: string | null;
  sourceRightsNote: string | null;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  submissionId: string | null;
  submissionKind: "url" | "document" | "transcript" | null;
  originalIdentifier: string | null;
  originalUrl: string | null;
  submittedBy: string | null;
  submittedAt: Date | null;
  submissionRetrievedAt: Date | null;
  submissionRightsNote: string | null;
  processingStatus: "submitted" | "processing" | "ready-for-review" | "escalated" | "rejected" | null;
  proposedTopic: string | null;
  proposedSubtopic: string | null;
  classificationConfidence: string | null;
  classificationRationale: string | null;
}>;

/** Pure mapper lets unit tests prove the editor data-minimisation boundary. */
export function mapReviewEvidence(rows: ReadonlyArray<ClaimEvidenceRow>): Readonly<{
  claims: ReadonlyArray<EditorialClaim>;
  sources: ReadonlyArray<EditorialEvidenceSource>;
}> {
  type MutableClaim = Omit<EditorialClaim, "supports"> & { supports: EditorialClaim["supports"] extends ReadonlyArray<infer Support> ? Support[] : never };
  const claimsById = new Map<string, MutableClaim>();
  const sourcesById = new Map<string, EditorialEvidenceSource>();
  for (const row of rows) {
    const claim: MutableClaim = claimsById.get(row.claimId) ?? {
      id: row.claimId,
      statement: row.statement,
      status: row.claimStatus,
      supports: [],
    };
    if (row.supportId && row.sourceId && row.supportKind && row.supportAddedBy && row.supportAddedAt) {
      claim.supports = [...claim.supports, {
        id: row.supportId,
        sourceId: row.sourceId,
        kind: row.supportKind,
        ...(row.locator ? { locator: row.locator } : {}),
        ...(row.excerpt ? { excerpt: row.excerpt } : {}),
        ...(row.rationale ? { rationale: row.rationale } : {}),
        addedBy: row.supportAddedBy,
        addedAt: row.supportAddedAt.toISOString(),
      }];
      if (!sourcesById.has(row.sourceId)) sourcesById.set(row.sourceId, sourceFrom(row));
    }
    claimsById.set(row.claimId, claim);
  }
  return { claims: [...claimsById.values()], sources: [...sourcesById.values()] };
}

function sourceFrom(row: ClaimEvidenceRow): EditorialEvidenceSource {
  if (!row.sourceId || !row.sourceTitle || !row.sourcePublisher || !row.sourceType || !row.canonicalUrl || !row.sourceRetrievedAt || !row.sourceRelation || !row.sourceRightsNote || !row.acceptedBy || !row.acceptedAt) {
    throw new Error("A Claim Support references an incomplete Accepted Source record.");
  }
  const submission = submissionFrom(row);
  return {
    id: row.sourceId,
    title: row.sourceTitle,
    publisher: row.sourcePublisher,
    sourceType: row.sourceType,
    canonicalUrl: row.canonicalUrl,
    ...(row.externalIdentifier ? { externalIdentifier: row.externalIdentifier } : {}),
    ...(row.sourcePublishedAt ? { publishedAt: row.sourcePublishedAt.toISOString() } : {}),
    retrievedAt: row.sourceRetrievedAt.toISOString(),
    relation: row.sourceRelation,
    rightsNote: row.sourceRightsNote,
    acceptedBy: row.acceptedBy,
    acceptedAt: row.acceptedAt.toISOString(),
    ...(submission ? { submission } : {}),
  };
}

function submissionFrom(row: ClaimEvidenceRow): EditorialSourceSubmissionProvenance | undefined {
  if (!row.submissionId || !row.submissionKind || !row.originalIdentifier || !row.submittedBy || !row.submittedAt || !row.submissionRightsNote || !row.processingStatus) return undefined;
  return {
    id: row.submissionId,
    kind: row.submissionKind,
    originalIdentifier: row.originalIdentifier,
    ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt.toISOString(),
    ...(row.submissionRetrievedAt ? { retrievedAt: row.submissionRetrievedAt.toISOString() } : {}),
    rightsNote: row.submissionRightsNote,
    processingStatus: row.processingStatus,
    ...(row.proposedTopic ? { proposedTopic: row.proposedTopic } : {}),
    ...(row.proposedSubtopic ? { proposedSubtopic: row.proposedSubtopic } : {}),
    ...(row.classificationConfidence === null ? {} : { classificationConfidence: Number(row.classificationConfidence) }),
    ...(row.classificationRationale ? { classificationRationale: row.classificationRationale } : {}),
  };
}

function latestActivity(revisionCreatedAt: Date, audits: ReadonlyArray<EditorialAuditRecord>): Date {
  const mostRecentAudit = audits[0];
  return mostRecentAudit && new Date(mostRecentAudit.occurredAt) > revisionCreatedAt
    ? new Date(mostRecentAudit.occurredAt)
    : revisionCreatedAt;
}

function compareEditorialWork(left: EditorialWorkItem, right: EditorialWorkItem): number {
  const priority: Record<EditorialStatus, number> = {
    "needs-verification": 0,
    "in-editorial-review": 1,
    approved: 2,
    draft: 3,
    published: 4,
    archived: 5,
  };
  return priority[left.status] - priority[right.status] || left.freshness.lastActivityAt.localeCompare(right.freshness.lastActivityAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
