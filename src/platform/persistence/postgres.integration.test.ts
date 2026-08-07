import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEditorialWorkflowCommand } from "@/modules/editorial/editorial-workflow-command";
import {
  createAcceptPreparedProposalCommand,
  fingerprintProposalOutput,
} from "@/modules/editorial/accept-prepared-proposal-command";
import { createTopicRequestCommand } from "@/modules/discovery/topic-request-command";
import { createAcceptSourceFromSubmissionCommand } from "@/modules/evidence/accept-source-from-submission-command";

import {
  DrizzleEditorialRepository,
  DrizzlePublishedCatalogueRepository,
} from "./content-repositories";
import { DrizzleAcceptPreparedProposalRepository } from "./accept-prepared-proposal-repository";
import { DrizzleAcceptSourceFromSubmissionRepository } from "./accept-source-from-submission-repository";
import { DrizzleTopicRequestDemandRepository } from "./topic-request-repository";
import { createPostgresPersistence, type PostgresPersistence } from "./postgres";
import {
  acceptedSources,
  briefingRevisions,
  briefings,
  claimSupports,
  claims,
  proposalDecisionRecords,
  sourceSubmissions,
  topics,
  topicRequestDemands,
} from "./schema";
import { testPostgresConnectionConfigFromEnvironment } from "./test-database";

const templateContent = {
  oneSentenceExplanation: "A concise explanation.",
  thirtySecondOverview: "A quick overview.",
  fiveMinuteExplanation: "A fuller explanation.",
  whyPeopleCare: "It helps people participate.",
  keyTerms: [{ term: "Term", definition: "A clear definition." }],
  entities: ["Parliament"],
  debates: ["A genuine question"],
  singaporeSeaAngle: "Singapore context.",
  questionsToAsk: ["What changed?"],
  mistakesToAvoid: ["Do not overgeneralise."],
};

describe("Postgres editorial workflow", () => {
  let persistence: PostgresPersistence;

  beforeAll(async () => {
    persistence = createPostgresPersistence(testPostgresConnectionConfigFromEnvironment());
    await migrate(persistence.db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await persistence?.close();
  });

  it("publishes a source-backed Briefing through the Drizzle repository seam", async () => {
    const runId = randomUUID();
    const slug = `postgres-workflow-${runId}`;
    const [topic] = await persistence.db
      .insert(topics)
      .values({ slug, title: "Postgres workflow test", description: "An isolated test fixture." })
      .returning({ id: topics.id });
    const [briefing] = await persistence.db
      .insert(briefings)
      .values({ topicId: topic.id, templateVersion: "v1" })
      .returning({ id: briefings.id });
    const [revision] = await persistence.db
      .insert(briefingRevisions)
      .values({
        briefingId: briefing.id,
        sequence: 1,
        templateVersion: "v1",
        content: templateContent,
        origin: "human",
        createdBy: "postgres-integration-test",
      })
      .returning({ id: briefingRevisions.id });
    const [source] = await persistence.db
      .insert(acceptedSources)
      .values({
        title: "Test source",
        publisher: "KopiContext test harness",
        sourceType: "test",
        canonicalUrl: `https://example.test/sources/${runId}`,
        retrievedAt: new Date("2026-08-07T00:00:00.000Z"),
        relation: "Supports the test claim.",
        rightsNote: "Test fixture only.",
        acceptedBy: "postgres-integration-test",
      })
      .returning({ id: acceptedSources.id });
    const [claim] = await persistence.db
      .insert(claims)
      .values({
        briefingRevisionId: revision.id,
        statement: "The fixture has an accepted source.",
        status: "verified",
        createdBy: "postgres-integration-test",
      })
      .returning({ id: claims.id });
    await persistence.db.insert(claimSupports).values({
      claimId: claim.id,
      acceptedSourceId: source.id,
      addedBy: "postgres-integration-test",
    });

    const editorial = new DrizzleEditorialRepository(persistence.db);
    const command = createEditorialWorkflowCommand(editorial);
    for (const to of ["needs-verification", "in-editorial-review", "approved", "published"] as const) {
      const result = await command.transition({
        briefingId: briefing.id,
        to,
        actorId: "postgres-integration-test",
        occurredAt: "2026-08-07T12:00:00.000Z",
      });
      expect(result).toMatchObject({ ok: true, status: to });
    }

    const publicCatalogue = new DrizzlePublishedCatalogueRepository(persistence.db);
    await expect(publicCatalogue.findPublishedBriefingBySlug(slug)).resolves.toMatchObject({
      slug,
      title: "Postgres workflow test",
      status: "published",
      sources: [
        {
          title: "Test source",
          publisher: "KopiContext test harness",
          url: `https://example.test/sources/${runId}`,
        },
      ],
    });
    await expect(editorial.listAuditRecords(briefing.id)).resolves.toHaveLength(4);
  });

  it("folds accepted Topic requests into one privacy-bounded demand aggregate", async () => {
    const requestedTopic = `Postgres discovery ${randomUUID()}`;
    const repository = new DrizzleTopicRequestDemandRepository(persistence.db);
    const command = createTopicRequestCommand(repository, {
      now: () => new Date("2026-08-07T12:00:00.000Z"),
    });

    await command.submit({ requestedTopic });
    await command.submit({ requestedTopic });

    await expect(repository.listDemand()).resolves.toContainEqual({
      requestedTopic,
      requestCount: 2,
      firstRequestedAt: "2026-08-07T12:00:00.000Z",
      lastRequestedAt: "2026-08-07T12:00:00.000Z",
    });
    const rows = await persistence.db
      .select()
      .from(topicRequestDemands)
      .where(eq(topicRequestDemands.requestedTopic, requestedTopic));
    expect(rows).toHaveLength(1);
  });

  it("atomically accepts a prepared proposal into a new unpublished Briefing without accepting evidence", async () => {
    const runId = randomUUID();
    const submissionId = randomUUID();
    const proposal = {
      classification: {
        proposedTopic: `Proposal topic ${runId}`,
        confidence: 0.95,
        rationale: "A reviewed test proposal.",
      },
      candidateClaims: [],
      draft: {
        templateVersion: "v1",
        title: `Proposal topic ${runId}`,
        sections: [{ section: "oneSentenceExplanation", body: "A draft still needs evidence review." }],
      },
      risks: [],
      provider: "postgres-test-provider",
      model: "postgres-test-model",
      promptVersion: "postgres-test-prompt-v1",
    };
    await persistence.db.insert(sourceSubmissions).values({
      id: submissionId,
      idempotencyKey: `source-preparation:${runId}`,
      kind: "transcript",
      originalIdentifier: `postgres:proposal:${runId}`,
      submittedBy: "postgres-integration-test",
      submittedAt: new Date("2026-08-08T09:00:00.000Z"),
      rightsNote: "Test-only rights note.",
      processingStatus: "ready-for-review",
      preparationResultState: "prepared",
      canonicalIdentifier: `postgres:proposal:${runId}`,
      contentFingerprint: `sha256:${runId}`,
      retrievedAt: new Date("2026-08-08T09:01:00.000Z"),
      processingHistory: [{ stage: "prepared", occurredAt: "2026-08-08T09:02:00.000Z", detail: "Prepared for test." }],
      processorProvider: proposal.provider,
      processorModel: proposal.model,
      promptVersion: proposal.promptVersion,
      processorInputProvenance: { retrievedFrom: "postgres integration fixture" },
      processorOutput: proposal,
      processedAt: new Date("2026-08-08T09:02:00.000Z"),
    });

    const repository = new DrizzleAcceptPreparedProposalRepository(persistence.db);
    const command = createAcceptPreparedProposalCommand(repository);
    const input = {
      idempotencyKey: `proposal-acceptance:${runId}`,
      submissionId,
      expectedOutputFingerprint: fingerprintProposalOutput(proposal),
      actorId: "postgres-integration-test",
      occurredAt: "2026-08-08T10:00:00.000Z",
      topic: { slug: `proposal-topic-${runId}`, description: "An isolated proposal-acceptance fixture." },
    };

    const first = await command.accept(input);
    expect(first).toMatchObject({ ok: true, kind: "created" });
    const replay = await command.accept(input);
    expect(replay).toMatchObject({ ok: true, kind: "idempotent" });
    if (!first.ok || !replay.ok) throw new Error("The prepared proposal should be accepted.");
    expect(replay).toMatchObject({
      topicId: first.topicId,
      briefingId: first.briefingId,
      revisionId: first.revisionId,
      decisionId: first.decisionId,
    });

    await expect(
      persistence.db.select().from(briefings).where(eq(briefings.id, first.briefingId)),
    ).resolves.toContainEqual(expect.objectContaining({ status: "draft" }));
    await expect(
      persistence.db.select().from(briefingRevisions).where(eq(briefingRevisions.id, first.revisionId)),
    ).resolves.toContainEqual(expect.objectContaining({
      origin: "agent",
      sourceSubmissionId: submissionId,
      generationOutput: proposal,
    }));
    await expect(
      persistence.db.select().from(proposalDecisionRecords).where(eq(proposalDecisionRecords.id, first.decisionId)),
    ).resolves.toContainEqual(expect.objectContaining({
      sourceSubmissionId: submissionId,
      proposalPart: "classification-and-draft",
      outcome: "accepted",
      actorId: "postgres-integration-test",
    }));
    await expect(
      persistence.db.select().from(acceptedSources).where(eq(acceptedSources.acceptedFromSubmissionId, submissionId)),
    ).resolves.toEqual([]);
    await expect(
      persistence.db.select().from(claims).where(eq(claims.briefingRevisionId, first.revisionId)),
    ).resolves.toEqual([]);

    const sourceAcceptance = await createAcceptSourceFromSubmissionCommand(
      new DrizzleAcceptSourceFromSubmissionRepository(persistence.db),
    ).accept({
      idempotencyKey: `source-acceptance:${runId}`,
      submissionId,
      expectedOutputFingerprint: fingerprintProposalOutput(proposal),
      actorId: "postgres-integration-test",
      occurredAt: "2026-08-08T10:01:00.000Z",
      source: {
        title: "Postgres test source",
        publisher: "KopiContext test harness",
        sourceType: "test",
        canonicalUrl: `https://example.test/proposals/${runId}`,
        retrievedAt: "2026-08-08T09:01:00.000Z",
        relation: "Supports later verification.",
        rightsNote: "Test fixture only.",
      },
    });
    expect(sourceAcceptance).toMatchObject({ ok: true, kind: "created" });
    if (!sourceAcceptance.ok) throw new Error("The editor should be able to accept the Source.");
    await expect(
      persistence.db.select().from(proposalDecisionRecords).where(eq(proposalDecisionRecords.id, sourceAcceptance.decisionId)),
    ).resolves.toContainEqual(expect.objectContaining({
      proposalPart: "source",
      acceptedSourceId: sourceAcceptance.acceptedSourceId,
      topicId: null,
      briefingId: null,
      briefingRevisionId: null,
    }));
    await expect(
      persistence.db.select().from(claims).where(eq(claims.briefingRevisionId, first.revisionId)),
    ).resolves.toEqual([]);
  });
});
