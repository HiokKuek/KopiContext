export type PreparedSubmissionForSourceAcceptance =
  | Readonly<{ submissionId: string; state: "prepared" | "needs-review"; outputFingerprint: string }>
  | Readonly<{ submissionId: string; state: "duplicate" | "failed" }>;

export type SourceAcceptanceMetadata = Readonly<{
  title: string;
  publisher: string;
  sourceType: string;
  canonicalUrl: string;
  externalIdentifier?: string;
  publishedAt?: string;
  retrievedAt: string;
  relation: string;
  rightsNote: string;
}>;

export type AcceptSourceFromSubmissionRequest = Readonly<{
  idempotencyKey: string;
  submissionId: string;
  expectedOutputFingerprint: string;
  actorId: string;
  occurredAt: string;
  source: SourceAcceptanceMetadata;
}>;

export type AcceptSourceFromSubmissionPersistenceRequest = Readonly<{
  idempotencyKey: string;
  submissionId: string;
  expectedOutputFingerprint: string;
  actorId: string;
  occurredAt: string;
  source: SourceAcceptanceMetadata & Readonly<{ acceptedFromSubmissionId: string; acceptedBy: string; acceptedAt: string }>;
}>;

export type AcceptSourceFromSubmissionRepository = Readonly<{
  retrievePreparedSubmission(submissionId: string): Promise<PreparedSubmissionForSourceAcceptance | undefined>;
  acceptSourceFromSubmission(input: AcceptSourceFromSubmissionPersistenceRequest): Promise<
    | Readonly<{ kind: "created" | "idempotent"; acceptedSourceId: string; decisionId: string }>
    | Readonly<{ kind: "proposal-conflict" | "source-conflict" | "idempotency-conflict" | "proposal-not-ready" }>
  >;
}>;

export type AcceptSourceFromSubmissionCommand = Readonly<{
  accept(request: AcceptSourceFromSubmissionRequest): Promise<
    | Readonly<{ ok: true; kind: "created" | "idempotent"; acceptedSourceId: string; decisionId: string }>
    | Readonly<{ ok: false; reason: "acceptance-requires-editor" | "proposal-not-found" | "proposal-not-ready" | "proposal-conflict" | "source-conflict" | "idempotency-conflict" | "invalid-source" }>
  >;
}>;

/** Explicitly accepts a Source; it cannot create Claims, revise a Briefing, or publish. */
export function createAcceptSourceFromSubmissionCommand(repository: AcceptSourceFromSubmissionRepository): AcceptSourceFromSubmissionCommand {
  return {
    async accept(request) {
      if (!text(request.actorId)) return { ok: false, reason: "acceptance-requires-editor" } as const;
      if (!validSource(request.source)) return { ok: false, reason: "invalid-source" } as const;
      const prepared = await repository.retrievePreparedSubmission(request.submissionId);
      if (!prepared) return { ok: false, reason: "proposal-not-found" } as const;
      if (prepared.state !== "prepared" && prepared.state !== "needs-review") return { ok: false, reason: "proposal-not-ready" } as const;
      if (prepared.outputFingerprint !== request.expectedOutputFingerprint) return { ok: false, reason: "proposal-conflict" } as const;
      const result = await repository.acceptSourceFromSubmission({
        ...request,
        actorId: request.actorId.trim(),
        source: {
          ...trimSource(request.source),
          acceptedFromSubmissionId: request.submissionId,
          acceptedBy: request.actorId.trim(),
          acceptedAt: request.occurredAt,
        },
      });
      return result.kind === "created" || result.kind === "idempotent" ? { ok: true, ...result } : { ok: false, reason: result.kind };
    },
  };
}

function validSource(source: SourceAcceptanceMetadata): boolean {
  return [source.title, source.publisher, source.sourceType, source.canonicalUrl, source.retrievedAt, source.relation, source.rightsNote].every(text)
    && validDate(source.retrievedAt)
    && (source.publishedAt === undefined || validDate(source.publishedAt));
}
function text(value: string | undefined): boolean { return value?.trim().length !== 0; }
function validDate(value: string): boolean { return !Number.isNaN(Date.parse(value)); }
function trimSource(source: SourceAcceptanceMetadata): SourceAcceptanceMetadata {
  return {
    ...source, title: source.title.trim(), publisher: source.publisher.trim(), sourceType: source.sourceType.trim(), canonicalUrl: source.canonicalUrl.trim(), retrievedAt: source.retrievedAt.trim(), relation: source.relation.trim(), rightsNote: source.rightsNote.trim(),
    ...(source.externalIdentifier?.trim() ? { externalIdentifier: source.externalIdentifier.trim() } : {}),
    ...(source.publishedAt ? { publishedAt: source.publishedAt.trim() } : {}),
  };
}
