import { describe, expect, it } from "vitest";

import {
  EditorialTransitionConflictError,
  InMemoryEditorialRepository,
  type EditorialRepository,
  type EditorialRevision,
} from "./editorial-repository";
import {
  createEditorialWorkflowCommand,
  type EditorialWorkflowCommand,
} from "./editorial-workflow-command";
import type { EditorialItem } from "./editorial-workflow";

const briefing: EditorialItem = {
  id: "briefing-government",
  status: "in-editorial-review",
  revisionId: "revision-2",
  template: { isComplete: true },
  acceptedSources: [{ id: "constitution" }],
  claims: [{ id: "government-claim", isSupported: true }],
};

const revision: EditorialRevision = {
  id: "revision-2",
  itemId: "briefing-government",
  sequence: 2,
  templateVersion: "v1",
  content: { title: "How Singapore's Government Works" },
  createdAt: "2026-08-07T09:00:00.000Z",
};

function commandFor(repository: EditorialRepository): EditorialWorkflowCommand {
  return createEditorialWorkflowCommand(repository);
}

describe("EditorialWorkflowCommand", () => {
  it("approves a current Briefing and returns its persisted audit record", async () => {
    const repository = new InMemoryEditorialRepository({ items: [briefing], revisions: [revision] });

    const result = await commandFor(repository).transition({
      briefingId: briefing.id,
      to: "approved",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      briefingId: briefing.id,
      revisionId: revision.id,
      status: "approved",
      audit: {
        itemId: briefing.id,
        revisionId: revision.id,
        from: "in-editorial-review",
        to: "approved",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      },
    });
    await expect(repository.retrieveById(briefing.id)).resolves.toMatchObject({ status: "approved" });
    await expect(repository.listAuditRecords(briefing.id)).resolves.toHaveLength(1);
  });

  it("reports a missing Briefing without attempting a state change", async () => {
    const repository = new InMemoryEditorialRepository({ revisions: [revision] });

    await expect(
      commandFor(repository).transition({
        briefingId: "missing-briefing",
        to: "approved",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      }),
    ).resolves.toEqual({ ok: false, reason: "briefing-not-found" });
  });

  it("returns editorial validation failures without persisting them", async () => {
    const repository = new InMemoryEditorialRepository({ items: [briefing], revisions: [revision] });

    await expect(
      commandFor(repository).transition({
        briefingId: briefing.id,
        to: "published",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid-transition" });
    await expect(repository.listAuditRecords(briefing.id)).resolves.toEqual([]);
  });

  it("maps a known stale-write failure to a transition conflict", async () => {
    const repository: EditorialRepository = {
      retrieveById: async () => briefing,
      persistTransition: async () => {
        throw new EditorialTransitionConflictError("The Briefing changed after it was reviewed.");
      },
      retrieveRevisionById: async () => revision,
      listRevisions: async () => [revision],
      listAuditRecords: async () => [],
    };

    await expect(
      commandFor(repository).transition({
        briefingId: briefing.id,
        to: "approved",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      }),
    ).resolves.toEqual({ ok: false, reason: "transition-conflict" });
  });

  it("does not hide an unexpected persistence failure as a conflict", async () => {
    const repository: EditorialRepository = {
      retrieveById: async () => briefing,
      persistTransition: async () => {
        throw new Error("Postgres is unavailable");
      },
      retrieveRevisionById: async () => revision,
      listRevisions: async () => [revision],
      listAuditRecords: async () => [],
    };

    await expect(
      commandFor(repository).transition({
        briefingId: briefing.id,
        to: "approved",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      }),
    ).rejects.toThrow("Postgres is unavailable");
  });
});
