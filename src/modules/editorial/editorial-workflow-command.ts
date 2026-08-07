import {
  EditorialTransitionConflictError,
  type EditorialRepository,
} from "./editorial-repository";
import {
  evaluateEditorialTransition,
  type EditorialAuditRecord,
  type EditorialStatus,
  type EditorialTransitionFailure,
} from "./editorial-workflow";

/** The transport-neutral command for one human editorial state change. */
export type EditorialTransitionCommand = Readonly<{
  briefingId: string;
  to: EditorialStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
}>;

export type EditorialWorkflowCommandFailure =
  | EditorialTransitionFailure
  | Readonly<{ ok: false; reason: "briefing-not-found" | "transition-conflict" }>;

export type EditorialWorkflowCommandSuccess = Readonly<{
  ok: true;
  briefingId: string;
  revisionId: string;
  status: EditorialStatus;
  audit: EditorialAuditRecord;
}>;

export type EditorialWorkflowCommandResult =
  | EditorialWorkflowCommandSuccess
  | EditorialWorkflowCommandFailure;

/**
 * The application seam for editorial commands. It loads the current Briefing,
 * evaluates the domain rules, and asks the repository to atomically persist a
 * successful state-and-audit pair. The repository detects stale writes, so a
 * read/evaluate/write race cannot overwrite a newer editorial decision.
 */
export type EditorialWorkflowCommand = Readonly<{
  transition(command: EditorialTransitionCommand): Promise<EditorialWorkflowCommandResult>;
}>;

export function createEditorialWorkflowCommand(
  repository: EditorialRepository,
): EditorialWorkflowCommand {
  return {
    async transition(command): Promise<EditorialWorkflowCommandResult> {
      const item = await repository.retrieveById(command.briefingId);
      if (!item) {
        return { ok: false, reason: "briefing-not-found" };
      }

      const outcome = evaluateEditorialTransition(item, {
        to: command.to,
        actorId: command.actorId,
        ...(command.reason === undefined ? {} : { reason: command.reason }),
        occurredAt: command.occurredAt,
      });
      if (!outcome.ok) {
        return outcome;
      }

      try {
        await repository.persistTransition(outcome);
      } catch (error) {
        if (error instanceof EditorialTransitionConflictError) {
          return { ok: false, reason: "transition-conflict" };
        }
        throw error;
      }

      return {
        ok: true,
        briefingId: outcome.item.id,
        revisionId: outcome.item.revisionId,
        status: outcome.item.status,
        audit: outcome.audit,
      };
    },
  };
}
