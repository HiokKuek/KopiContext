import type { FastifyInstance } from "fastify";

import type {
  AcceptPreparedProposalCommand,
  AcceptPreparedProposalResult,
} from "@/modules/editorial/accept-prepared-proposal-command";

/** Narrow HTTP-facing alias for the Phase A application command. */
export type PreparedProposalAcceptanceCommand = Pick<AcceptPreparedProposalCommand, "accept">;

export type PreparedProposalAcceptanceRouteDependencies = Readonly<{
  preparedProposalAcceptances: PreparedProposalAcceptanceCommand;
  now: () => Date;
  invalidRequest: (message: string) => Error;
  notFound: () => Error;
  conflict: () => Error;
  rejected: () => Error;
}>;

type AcceptanceBody = Readonly<{
  idempotencyKey: string;
  actorId: string;
  expectedOutputFingerprint: string;
  topic: Readonly<{ slug: string; description: string }>;
}>;

/**
 * Private BFF-only transport for accepting an agent proposal's classification
 * and draft into a new Draft Briefing. The BFF builds `actorId` from its
 * verified editor session; this route is never available to a browser.
 */
export function registerPreparedProposalAcceptanceRoute(
  app: FastifyInstance,
  dependencies: PreparedProposalAcceptanceRouteDependencies,
): void {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/source-submissions/:submissionId/acceptance",
    async (request, reply) => {
      const submissionId = readUuid(
        (request.params as Record<string, unknown>).submissionId,
        "submissionId",
        dependencies.invalidRequest,
      );
      const body = readAcceptanceBody(request.body);
      const outcome = await dependencies.preparedProposalAcceptances.accept({
        ...body,
        submissionId,
        occurredAt: dependencies.now().toISOString(),
      });

      if (!outcome.ok) {
        throw rejectionFor(outcome);
      }

      return reply.code(outcome.kind === "created" ? 201 : 200).send(successBody(outcome));
    },
  );

  function rejectionFor(outcome: Extract<AcceptPreparedProposalResult, { ok: false }>): Error {
    if (outcome.reason === "proposal-not-found") return dependencies.notFound();
    if (
      outcome.reason === "proposal-conflict" ||
      outcome.reason === "topic-conflict" ||
      outcome.reason === "idempotency-conflict"
    ) {
      return dependencies.conflict();
    }
    return dependencies.rejected();
  }

  function readAcceptanceBody(body: unknown): AcceptanceBody {
    if (!isPlainObject(body)) {
      throw dependencies.invalidRequest("Request body must be a JSON object.");
    }
    const allowedKeys = new Set(["idempotencyKey", "actorId", "expectedOutputFingerprint", "topic"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      throw dependencies.invalidRequest("Request body contains an unsupported field.");
    }

    const idempotencyKey = readOpaqueKey(body.idempotencyKey, "idempotencyKey", dependencies.invalidRequest);
    const actorId = readBoundedText(body.actorId, "actorId", 200, dependencies.invalidRequest);
    const expectedOutputFingerprint = readFingerprint(body.expectedOutputFingerprint, dependencies.invalidRequest);
    if (!isPlainObject(body.topic) || Object.keys(body.topic).some((key) => key !== "slug" && key !== "description")) {
      throw dependencies.invalidRequest("topic must contain only slug and description.");
    }
    const slug = readSlug(body.topic.slug, dependencies.invalidRequest);
    const description = readBoundedText(body.topic.description, "topic.description", 2_000, dependencies.invalidRequest);
    return { idempotencyKey, actorId, expectedOutputFingerprint, topic: { slug, description } };
  }
}

function successBody(outcome: Extract<AcceptPreparedProposalResult, { ok: true }>) {
  return {
    kind: outcome.kind,
    topicId: outcome.topicId,
    briefingId: outcome.briefingId,
    revisionId: outcome.revisionId,
    decisionId: outcome.decisionId,
  };
}

function readUuid(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw invalid(`${name} must be a valid UUID.`);
  }
  return value;
}

function readOpaqueKey(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !opaqueKeyPattern.test(value)) {
    throw invalid(`${name} must be an opaque 8–200 character command key.`);
  }
  return value;
}

function readFingerprint(value: unknown, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !fingerprintPattern.test(value)) {
    throw invalid("expectedOutputFingerprint must be a SHA-256 fingerprint.");
  }
  return value;
}

function readSlug(value: unknown, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !slugPattern.test(value)) {
    throw invalid("topic.slug must be a lowercase hyphenated slug.");
  }
  return value;
}

function readBoundedText(
  value: unknown,
  name: string,
  maximumLength: number,
  invalid: (message: string) => Error,
): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximumLength) {
    throw invalid(`${name} must be a non-empty string of at most ${maximumLength} characters.`);
  }
  return value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaqueKeyPattern = /^[A-Za-z0-9._:-]{8,200}$/;
const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
