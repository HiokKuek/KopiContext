import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEditorialWorkflowCommand } from "@/modules/editorial/editorial-workflow-command";
import { createTopicRequestCommand } from "@/modules/discovery/topic-request-command";

import {
  DrizzleEditorialRepository,
  DrizzlePublishedCatalogueRepository,
} from "./content-repositories";
import { DrizzleTopicRequestDemandRepository } from "./topic-request-repository";
import { createPostgresPersistence, type PostgresPersistence } from "./postgres";
import {
  acceptedSources,
  briefingRevisions,
  briefings,
  claimSupports,
  claims,
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
});
