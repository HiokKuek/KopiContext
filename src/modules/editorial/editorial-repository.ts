import type {
  EditorialAuditRecord,
  EditorialItem,
  EditorialTransitionOutcome,
  EditorialTransitionSuccess,
} from "./editorial-workflow";

/**
 * One immutable version of an editorial item. The versioned template owns the
 * shape of `content`, so this boundary retains it without interpreting it.
 */
export type EditorialRevision = {
  id: string;
  itemId: string;
  sequence: number;
  templateVersion: string;
  content: Readonly<Record<string, unknown>>;
  createdAt: string;
};

/**
 * The persistence port owned by the Editorial Workflow. A production adapter
 * must make `persistTransition` a single database transaction: a successful
 * state change and its Audit Record are never independently visible.
 */
export type EditorialRepository = {
  retrieveById(id: string): Promise<EditorialItem | undefined>;
  persistTransition(outcome: EditorialTransitionOutcome): Promise<void>;
  retrieveRevisionById(id: string): Promise<EditorialRevision | undefined>;
  listRevisions(itemId: string): Promise<ReadonlyArray<EditorialRevision>>;
  listAuditRecords(itemId: string): Promise<ReadonlyArray<EditorialAuditRecord>>;
};

export type InMemoryEditorialRepositorySeed = {
  items?: ReadonlyArray<EditorialItem>;
  revisions?: ReadonlyArray<EditorialRevision>;
  auditRecords?: ReadonlyArray<EditorialAuditRecord>;
};

function cloneItem(item: EditorialItem): EditorialItem {
  return {
    ...item,
    template: { ...item.template },
    acceptedSources: item.acceptedSources.map((source) => ({ ...source })),
    claims: item.claims.map((claim) => ({ ...claim })),
  };
}

function cloneRevision(revision: EditorialRevision): EditorialRevision {
  return {
    ...revision,
    content: structuredClone(revision.content),
  };
}

function cloneAuditRecord(record: EditorialAuditRecord): EditorialAuditRecord {
  return { ...record };
}

/**
 * Deterministic repository adapter for unit tests and local application
 * composition. It mirrors the production transaction contract by validating
 * every precondition before changing either the current item or audit history.
 */
export class InMemoryEditorialRepository implements EditorialRepository {
  private readonly items = new Map<string, EditorialItem>();
  private readonly revisions = new Map<string, EditorialRevision>();
  private readonly auditsByItemId = new Map<string, EditorialAuditRecord[]>();

  constructor(seed: InMemoryEditorialRepositorySeed = {}) {
    for (const item of seed.items ?? []) {
      this.items.set(item.id, cloneItem(item));
    }

    for (const revision of seed.revisions ?? []) {
      this.revisions.set(revision.id, cloneRevision(revision));
    }

    for (const audit of seed.auditRecords ?? []) {
      const records = this.auditsByItemId.get(audit.itemId) ?? [];
      records.push(cloneAuditRecord(audit));
      this.auditsByItemId.set(audit.itemId, records);
    }
  }

  async retrieveById(id: string): Promise<EditorialItem | undefined> {
    const item = this.items.get(id);
    return item ? cloneItem(item) : undefined;
  }

  /**
   * Failed evaluations are intentionally a no-op. For a success, all checks
   * happen before the two in-memory writes, matching the all-or-nothing
   * transaction required from the Postgres adapter.
   */
  async persistTransition(outcome: EditorialTransitionOutcome): Promise<void> {
    if (!outcome.ok) return;

    this.assertSuccessfulTransitionCanBeCommitted(outcome);

    const nextItem = cloneItem(outcome.item);
    const nextAudit = cloneAuditRecord(outcome.audit);
    const existingAudits = this.auditsByItemId.get(nextItem.id) ?? [];

    this.items.set(nextItem.id, nextItem);
    this.auditsByItemId.set(nextItem.id, [...existingAudits, nextAudit]);
  }

  async retrieveRevisionById(id: string): Promise<EditorialRevision | undefined> {
    const revision = this.revisions.get(id);
    return revision ? cloneRevision(revision) : undefined;
  }

  async listRevisions(itemId: string): Promise<ReadonlyArray<EditorialRevision>> {
    return [...this.revisions.values()]
      .filter((revision) => revision.itemId === itemId)
      .sort((left, right) => left.sequence - right.sequence)
      .map(cloneRevision);
  }

  async listAuditRecords(itemId: string): Promise<ReadonlyArray<EditorialAuditRecord>> {
    return (this.auditsByItemId.get(itemId) ?? []).map(cloneAuditRecord);
  }

  private assertSuccessfulTransitionCanBeCommitted(outcome: EditorialTransitionSuccess): void {
    const currentItem = this.items.get(outcome.item.id);
    if (!currentItem) {
      throw new Error(`Cannot transition editorial item ${outcome.item.id}: item was not found.`);
    }

    const revision = this.revisions.get(outcome.audit.revisionId);
    if (!revision || revision.itemId !== outcome.item.id) {
      throw new Error(
        `Cannot transition editorial item ${outcome.item.id}: audit revision does not belong to the item.`,
      );
    }

    if (
      currentItem.status !== outcome.audit.from ||
      currentItem.revisionId !== outcome.audit.revisionId ||
      outcome.item.revisionId !== outcome.audit.revisionId ||
      outcome.audit.itemId !== outcome.item.id
    ) {
      throw new Error(
        `Cannot transition editorial item ${outcome.item.id}: the persisted item is no longer the evaluated revision.`,
      );
    }
  }
}
