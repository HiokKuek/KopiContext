export type AttachCurrentUpdateSupportRequest = Readonly<{
  idempotencyKey: string;
  currentUpdateId: string;
  acceptedSourceId: string;
  excerpt: string;
  rationale: string;
  actorId: string;
  occurredAt: string;
}>;

export type AttachCurrentUpdateSupportRepository = Readonly<{
  attach(
    input: AttachCurrentUpdateSupportRequest,
  ): Promise<
    | Readonly<{ kind: "created" | "idempotent"; supportId: string }>
    | Readonly<{ kind: "idempotency-conflict" | "update-conflict" | "source-not-found" }>
  >;
}>;

export function attachCurrentUpdateSupportCommand(repository: AttachCurrentUpdateSupportRepository) {
  return {
    async attach(request: AttachCurrentUpdateSupportRequest) {
      if (!isValid(request)) return { ok: false as const, reason: "invalid-support" as const };

      const result = await repository.attach({
        ...request,
        actorId: request.actorId.trim(),
        excerpt: request.excerpt.trim(),
        rationale: request.rationale.trim(),
      });

      if (result.kind === "created" || result.kind === "idempotent") {
        return { ok: true as const, ...result };
      }

      return { ok: false as const, reason: result.kind };
    },
  };
}

function isValid(value: AttachCurrentUpdateSupportRequest) {
  return (
    /^[A-Za-z0-9._:-]{8,200}$/.test(value.idempotencyKey)
    && isUuid(value.currentUpdateId)
    && isUuid(value.acceptedSourceId)
    && Boolean(value.actorId.trim())
    && Boolean(value.excerpt.trim())
    && Boolean(value.rationale.trim())
    && !Number.isNaN(Date.parse(value.occurredAt))
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
