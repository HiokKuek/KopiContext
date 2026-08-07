export type CreateCurrentUpdateRequest = Readonly<{
  idempotencyKey: string;
  briefingId: string;
  actorId: string;
  occurredAt: string;
  title: string;
  body: string;
  effectiveAt: string;
}>;

export type CreateCurrentUpdateRepository = Readonly<{
  createDraft(input: CreateCurrentUpdateRequest): Promise<
    | Readonly<{ kind: "created" | "idempotent"; currentUpdateId: string }>
    | Readonly<{ kind: "briefing-not-found" | "idempotency-conflict" }>
  >;
}>;

/** Creates a private, dated update. Evidence and publication are separate commands. */
export function createCurrentUpdateCommand(repository: CreateCurrentUpdateRepository) {
  return {
    async create(request: CreateCurrentUpdateRequest) {
      if (!valid(request)) return { ok: false as const, reason: "invalid-update" as const };
      const result = await repository.createDraft({
        ...request,
        actorId: request.actorId.trim(),
        title: request.title.trim(),
        body: request.body.trim(),
      });
      return result.kind === "created" || result.kind === "idempotent"
        ? { ok: true as const, ...result }
        : { ok: false as const, reason: result.kind };
    },
  };
}

function valid(request: CreateCurrentUpdateRequest): boolean {
  return /^[A-Za-z0-9._:-]{8,200}$/.test(request.idempotencyKey)
    && uuid(request.briefingId)
    && request.actorId.trim().length > 0
    && date(request.occurredAt)
    && date(request.effectiveAt)
    && text(request.title, 500)
    && text(request.body, 8_000);
}

function uuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function date(value: string): boolean { return !Number.isNaN(Date.parse(value)); }
function text(value: string, maximum: number): boolean { return value.trim().length > 0 && value.length <= maximum; }
