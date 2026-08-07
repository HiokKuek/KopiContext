import { describe, expect, it } from "vitest";

import {
  InMemoryEditorialRepository,
  type EditorialRevision,
} from "./editorial-repository";
import {
  evaluateEditorialTransition,
  type EditorialItem,
  type EditorialStatus,
} from "./editorial-workflow";

const item = (status: EditorialStatus = "draft"): EditorialItem => ({
  id: "briefing-government",
  status,
  revisionId: "revision-2",
  template: { isComplete: true },
  acceptedSources: [{ id: "constitution" }],
  claims: [{ id: "government-claim", isSupported: true }],
});

const revisions: readonly EditorialRevision[] = [
  {
    id: "revision-1",
    itemId: "briefing-government",
    sequence: 1,
    templateVersion: "v1",
    content: { title: "First draft" },
    createdAt: "2026-08-07T08:00:00.000Z",
  },
  {
    id: "revision-2",
    itemId: "briefing-government",
    sequence: 2,
    templateVersion: "v1",
    content: { title: "Reviewed draft" },
    createdAt: "2026-08-07T09:00:00.000Z",
  },
];

describe("InMemoryEditorialRepository", () => {
  it("retrieves an item and its immutable revisions for editorial use cases", async () => {
    const repository = new InMemoryEditorialRepository({ items: [item()], revisions });

    expect(await repository.retrieveById("briefing-government")).toEqual(item());
    expect(await repository.retrieveRevisionById("revision-2")).toEqual(revisions[1]);
    expect(await repository.listRevisions("briefing-government")).toEqual(revisions);
    expect(await repository.listRevisions("missing-briefing")).toEqual([]);
  });

  it("does not persist an audit record or change state when transition evaluation fails", async () => {
    const repository = new InMemoryEditorialRepository({ items: [item("draft")], revisions });
    const outcome = evaluateEditorialTransition(item("draft"), {
      to: "published",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:00:00.000Z",
    });

    await repository.persistTransition(outcome);

    expect(await repository.retrieveById("briefing-government")).toEqual(item("draft"));
    expect(await repository.listAuditRecords("briefing-government")).toEqual([]);
  });

  it("persists a successful state change and its audit record as one commit", async () => {
    const repository = new InMemoryEditorialRepository({
      items: [item("in-editorial-review")],
      revisions,
    });
    const outcome = evaluateEditorialTransition(item("in-editorial-review"), {
      to: "approved",
      actorId: "editor-1",
      reason: "Every civic claim has been checked.",
      occurredAt: "2026-08-07T10:02:00.000Z",
    });

    await repository.persistTransition(outcome);

    await expect(repository.retrieveById("briefing-government")).resolves.toMatchObject({
      status: "approved",
    });
    await expect(repository.listAuditRecords("briefing-government")).resolves.toEqual([
      expect.objectContaining({
        itemId: "briefing-government",
        revisionId: "revision-2",
        from: "in-editorial-review",
        to: "approved",
        actorId: "editor-1",
      }),
    ]);
  });
});
