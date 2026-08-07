import type { FastifyInstance } from "fastify";
import type { AcceptSourceFromSubmissionCommand, SourceAcceptanceMetadata } from "@/modules/evidence/accept-source-from-submission-command";

export type SourceAcceptanceCommand = Pick<AcceptSourceFromSubmissionCommand, "accept">;
export type SourceAcceptanceRouteDependencies = Readonly<{
  sourceAcceptances: SourceAcceptanceCommand; now: () => Date;
  invalid: (message: string) => Error; notFound: () => Error; conflict: () => Error; rejected: () => Error;
}>;

/** Private BFF command; actorId is derived from the verified editor session. */
export function registerSourceAcceptanceRoute(app: FastifyInstance, dependencies: SourceAcceptanceRouteDependencies): void {
  app.post<{ Params: unknown; Body: unknown }>("/v1/editorial/source-submissions/:submissionId/sources", async (request, reply) => {
    const submissionId = uuid((request.params as Record<string, unknown>).submissionId, dependencies.invalid);
    const body = parse(request.body, dependencies.invalid);
    const outcome = await dependencies.sourceAcceptances.accept({ ...body, submissionId, occurredAt: dependencies.now().toISOString() });
    if (!outcome.ok) {
      if (outcome.reason === "proposal-not-found") throw dependencies.notFound();
      if (["proposal-conflict", "source-conflict", "idempotency-conflict"].includes(outcome.reason)) throw dependencies.conflict();
      throw dependencies.rejected();
    }
    return reply.code(outcome.kind === "created" ? 201 : 200).send({ kind: outcome.kind, acceptedSourceId: outcome.acceptedSourceId, decisionId: outcome.decisionId });
  });
}

type Body = Readonly<{ idempotencyKey: string; actorId: string; expectedOutputFingerprint: string; source: SourceAcceptanceMetadata }>;
function parse(value: unknown, invalid: (message: string) => Error): Body {
  if (!record(value)) throw invalid("Request body must be a JSON object.");
  const keys = ["idempotencyKey", "actorId", "expectedOutputFingerprint", "source"];
  if (Object.keys(value).some((key) => !keys.includes(key)) || !keys.every((key) => key in value)) throw invalid("Request body contains an unsupported field.");
  if (!text(value.idempotencyKey, 8, 200) || !/^[A-Za-z0-9._:-]+$/.test(value.idempotencyKey)) throw invalid("idempotencyKey must be an opaque 8–200 character command key.");
  if (!text(value.actorId, 1, 200)) throw invalid("actorId must be a non-empty string of at most 200 characters.");
  if (typeof value.expectedOutputFingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.expectedOutputFingerprint)) throw invalid("expectedOutputFingerprint must be a SHA-256 fingerprint.");
  const source = value.source;
  if (!record(source)) throw invalid("source must be a JSON object.");
  const required = ["title", "publisher", "sourceType", "canonicalUrl", "retrievedAt", "relation", "rightsNote"];
  const optional = ["externalIdentifier", "publishedAt"];
  if (Object.keys(source).some((key) => !required.includes(key) && !optional.includes(key)) || !required.every((key) => key in source)) throw invalid("source contains unsupported or missing fields.");
  if (!required.every((key) => text(source[key], 1, 2_000)) || !date(source.retrievedAt) || (source.publishedAt !== undefined && (!text(source.publishedAt, 1, 200) || !date(source.publishedAt)))) throw invalid("source contains invalid metadata.");
  return { idempotencyKey: value.idempotencyKey.trim(), actorId: value.actorId.trim(), expectedOutputFingerprint: value.expectedOutputFingerprint, source: {
    title: requiredText(source, "title", invalid), publisher: requiredText(source, "publisher", invalid), sourceType: requiredText(source, "sourceType", invalid), canonicalUrl: requiredText(source, "canonicalUrl", invalid), retrievedAt: requiredText(source, "retrievedAt", invalid), relation: requiredText(source, "relation", invalid), rightsNote: requiredText(source, "rightsNote", invalid),
    ...(text(source.externalIdentifier, 1, 2_000) ? { externalIdentifier: source.externalIdentifier.trim() } : {}), ...(text(source.publishedAt, 1, 200) ? { publishedAt: source.publishedAt.trim() } : {}),
  } };
}
function uuid(value: unknown, invalid: (message: string) => Error): string { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw invalid("submissionId must be a valid UUID."); return value; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, min: number, max: number): value is string { return typeof value === "string" && value.trim().length >= min && value.trim().length <= max; }
function requiredText(source: Record<string, unknown>, key: string, invalid: (message: string) => Error): string { const value = source[key]; if (!text(value, 1, 2_000)) throw invalid(`source.${key} is invalid.`); return value.trim(); }
function date(value: unknown): boolean { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
