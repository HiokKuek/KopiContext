import { desc, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  TopicRequestDemand,
  TopicRequestDemandRepository,
} from "@/modules/discovery/topic-request-command";

import { topicRequestDemands } from "./schema";

/**
 * A durable aggregate queue for editor discovery. Upsert is atomic so
 * concurrent accepted requests increment one Topic demand record rather than
 * creating reader-level rows.
 */
export class DrizzleTopicRequestDemandRepository implements TopicRequestDemandRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async recordAcceptedDemand(input: Readonly<{ requestedTopic: string; acceptedAt: string }>): Promise<void> {
    const acceptedAt = new Date(input.acceptedAt);
    await this.db
      .insert(topicRequestDemands)
      .values({
        requestedTopic: input.requestedTopic,
        requestCount: 1,
        firstRequestedAt: acceptedAt,
        lastRequestedAt: acceptedAt,
      })
      .onConflictDoUpdate({
        target: topicRequestDemands.requestedTopic,
        set: {
          requestCount: sql`${topicRequestDemands.requestCount} + 1`,
          lastRequestedAt: acceptedAt,
        },
      });
  }

  async listDemand(): Promise<ReadonlyArray<TopicRequestDemand>> {
    const rows = await this.db
      .select()
      .from(topicRequestDemands)
      .orderBy(desc(topicRequestDemands.requestCount), desc(topicRequestDemands.lastRequestedAt));

    return rows.map((row) => ({
      requestedTopic: row.requestedTopic,
      requestCount: row.requestCount,
      firstRequestedAt: row.firstRequestedAt.toISOString(),
      lastRequestedAt: row.lastRequestedAt.toISOString(),
    }));
  }
}
