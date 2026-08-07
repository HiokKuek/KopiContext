/**
 * The application seam for editorial state changes. Persistence and UI adapters
 * call this module; they do not decide which content may be published.
 */
export type EditorialStatus =
  | "draft"
  | "needs-verification"
  | "in-editorial-review"
  | "approved"
  | "published"
  | "archived";

export type EditorialItem = {
  id: string;
  status: EditorialStatus;
  revisionId: string;
  template: { isComplete: boolean };
  acceptedSources: ReadonlyArray<{ id: string }>;
  claims: ReadonlyArray<{ id: string; isSupported: boolean }>;
};

export type EditorialTransitionRequest = {
  to: EditorialStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
};

export type EditorialAuditRecord = {
  itemId: string;
  revisionId: string;
  from: EditorialStatus;
  to: EditorialStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
};

export type EditorialTransitionFailure = {
  ok: false;
  reason:
    | "transition-requires-actor"
    | "return-requires-reason"
    | "invalid-transition"
    | "publication-requires-editor"
    | "publication-requires-complete-template"
    | "publication-requires-accepted-source"
    | "publication-requires-supported-claims";
};

export type EditorialTransitionSuccess = {
  ok: true;
  item: EditorialItem;
  audit: EditorialAuditRecord;
};

export type EditorialTransitionOutcome = EditorialTransitionSuccess | EditorialTransitionFailure;

const allowedTransitions: Readonly<Record<EditorialStatus, ReadonlySet<EditorialStatus>>> = {
  draft: new Set(["needs-verification"]),
  "needs-verification": new Set(["draft", "in-editorial-review"]),
  "in-editorial-review": new Set(["draft", "needs-verification", "approved"]),
  approved: new Set(["draft", "needs-verification", "published"]),
  published: new Set(["archived"]),
  archived: new Set(["approved"]),
};

function hasValue(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function validatePublication(
  item: EditorialItem,
  request: EditorialTransitionRequest,
): EditorialTransitionFailure | undefined {
  if (!hasValue(request.actorId)) {
    return { ok: false, reason: "publication-requires-editor" };
  }

  if (!item.template.isComplete) {
    return { ok: false, reason: "publication-requires-complete-template" };
  }

  if (item.acceptedSources.length === 0) {
    return { ok: false, reason: "publication-requires-accepted-source" };
  }

  if (item.claims.length === 0 || item.claims.some((claim) => !claim.isSupported)) {
    return { ok: false, reason: "publication-requires-supported-claims" };
  }
}

/**
 * Evaluates one state change and returns the next immutable item plus its audit
 * record. A caller persists the successful pair atomically.
 */
export function evaluateEditorialTransition(
  item: EditorialItem,
  request: EditorialTransitionRequest,
): EditorialTransitionOutcome {
  const permittedTargets = allowedTransitions[item.status];
  if (!permittedTargets?.has(request.to)) {
    return { ok: false, reason: "invalid-transition" };
  }

  if (request.to === "published") {
    const publicationFailure = validatePublication(item, request);
    if (publicationFailure) {
      return publicationFailure;
    }
  }

  if (!hasValue(request.actorId)) {
    return { ok: false, reason: "transition-requires-actor" };
  }

  const isReturn =
    request.to === "draft" ||
    (request.to === "needs-verification" &&
      (item.status === "in-editorial-review" || item.status === "approved")) ||
    request.to === "archived";
  if (isReturn && !hasValue(request.reason)) {
    return { ok: false, reason: "return-requires-reason" };
  }

  return {
    ok: true,
    item: { ...item, status: request.to },
    audit: {
      itemId: item.id,
      revisionId: item.revisionId,
      from: item.status,
      to: request.to,
      actorId: request.actorId,
      ...(request.reason ? { reason: request.reason } : {}),
      occurredAt: request.occurredAt,
    },
  };
}
