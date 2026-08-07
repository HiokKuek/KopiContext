import {
  evaluateEditorialTransition,
  type EditorialStatus,
  type EditorialTransitionFailure,
} from "./editorial-workflow";

export type CurrentUpdateTransitionCommand = Readonly<{
  currentUpdateId: string;
  to: EditorialStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
}>;

export type CurrentUpdateWorkflowRepository = Readonly<{
  retrieve(id: string): Promise<
    | Readonly<{ id: string; status: EditorialStatus; hasAcceptedSource: boolean }>
    | undefined
  >;
  persist(input: Readonly<{
    currentUpdateId: string;
    from: EditorialStatus;
    to: EditorialStatus;
    actorId: string;
    reason?: string;
    occurredAt: string;
  }>): Promise<"persisted" | "conflict">;
}>;

export type CurrentUpdateWorkflowResult =
  | Readonly<{ ok: true; currentUpdateId: string; status: EditorialStatus }>
  | EditorialTransitionFailure
  | Readonly<{ ok: false; reason: "current-update-not-found" | "transition-conflict" }>;

/**
 * Applies the same human editorial state machine used for Briefings to a
 * Current Update. The update itself is its immutable review target: a dated
 * title/body/effective date must exist, and at least one Accepted Source must
 * be attached before publication can be considered.
 */
export function createCurrentUpdateWorkflowCommand(
  repository: CurrentUpdateWorkflowRepository,
) {
  return {
    async transition(command: CurrentUpdateTransitionCommand): Promise<CurrentUpdateWorkflowResult> {
      const update = await repository.retrieve(command.currentUpdateId);
      if (!update) return { ok: false, reason: "current-update-not-found" };

      const outcome = evaluateEditorialTransition(
        {
          id: update.id,
          status: update.status,
          revisionId: update.id,
          template: { isComplete: true },
          acceptedSources: update.hasAcceptedSource ? [{ id: "accepted-source" }] : [],
          claims: update.hasAcceptedSource ? [{ id: "dated-update", isSupported: true }] : [],
        },
        command,
      );
      if (!outcome.ok) return outcome;

      const result = await repository.persist({
        currentUpdateId: update.id,
        from: outcome.audit.from,
        to: outcome.audit.to,
        actorId: outcome.audit.actorId,
        ...(outcome.audit.reason ? { reason: outcome.audit.reason } : {}),
        occurredAt: outcome.audit.occurredAt,
      });
      if (result === "conflict") return { ok: false, reason: "transition-conflict" };
      return { ok: true, currentUpdateId: update.id, status: outcome.item.status };
    },
  };
}
