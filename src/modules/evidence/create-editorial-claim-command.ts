export type EditorialClaim = Readonly<{
  statement: string;
  excerpt: string;
  rationale: string;
}>;

export type CreateEditorialClaimRequest = Readonly<{
  idempotencyKey: string;
  briefingId: string;
  briefingRevisionId: string;
  acceptedSourceId: string;
  actorId: string;
  occurredAt: string;
  claim: EditorialClaim;
}>;

export type CreateEditorialClaimRepository = Readonly<{
  create(
    request: CreateEditorialClaimRequest,
  ): Promise<
    | Readonly<{ kind: "created" | "idempotent"; claimId: string; claimSupportId: string; recordId: string }>
    | Readonly<{ kind: "briefing-conflict" | "source-not-found" | "idempotency-conflict" }>
  >;
}>;

/**
 * Creates a human-authored, source-supported Claim. This is intentionally a
 * separate command from Source acceptance: accepting material says it may be
 * used as evidence; creating a Claim says the editor has checked a specific
 * statement against an excerpt from that Source.
 */
export function createEditorialClaimCommand(repository: CreateEditorialClaimRepository) {
  return {
    async create(request: CreateEditorialClaimRequest) {
      if (!valid(request)) return { ok: false as const, reason: "invalid-request" as const };

      const result = await repository.create({
        ...request,
        actorId: request.actorId.trim(),
        claim: cleanClaim(request.claim),
      });

      return result.kind === "created" || result.kind === "idempotent"
        ? { ok: true as const, ...result }
        : { ok: false as const, reason: result.kind };
    },
  };
}

function valid(request: CreateEditorialClaimRequest): boolean {
  return (
    /^[A-Za-z0-9._:-]{8,200}$/.test(request.idempotencyKey)
    && isId(request.briefingId)
    && isId(request.briefingRevisionId)
    && isId(request.acceptedSourceId)
    && request.actorId.trim().length > 0
    && validDate(request.occurredAt)
    && validText(request.claim.statement, 4_000)
    && validText(request.claim.excerpt, 8_000)
    && validText(request.claim.rationale, 4_000)
  );
}

function isId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function validText(value: string, maximum: number): boolean {
  return value.trim().length > 0 && value.length <= maximum;
}

function cleanClaim(claim: EditorialClaim): EditorialClaim {
  return {
    statement: claim.statement.trim(),
    excerpt: claim.excerpt.trim(),
    rationale: claim.rationale.trim(),
  };
}
