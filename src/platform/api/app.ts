import Fastify, { type FastifyInstance } from "fastify";

import type { PublishedBriefing } from "@/modules/content/published-briefings";
import type { EditorialReadRepository } from "@/modules/editorial/editorial-read-model";
import type { SourceSubmissionReadRepository } from "@/modules/preparation/source-submission-read-model";
import type { CandidateClaimAcceptanceContextQuery } from "@/modules/evidence/candidate-claim-acceptance-context";

import {
  type PrivateServiceIdentity,
  type ServiceCredentialAuthenticator,
} from "./service-auth";
import {
  registerEditorialTransitionRoute,
  type EditorialBriefingTransitionCommand,
} from "./editorial-transition-route";
import {
  registerSourceSubmissionRoute,
  type SourceSubmissionCommand,
} from "./source-submission-route";
import {
  registerAnonymousAnalyticsEventRoute,
  type AnonymousAnalyticsEventCommand,
} from "./analytics-event-route";
import { registerTopicRequestRoute, type TopicRequestCommand } from "./topic-request-route";
import { registerEditorialReadRoutes } from "./editorial-read-routes";
import { registerSourceSubmissionReadRoutes } from "./source-submission-read-routes";
import {
  registerPreparedProposalAcceptanceRoute,
  type PreparedProposalAcceptanceCommand,
} from "./prepared-proposal-acceptance-route";
import { registerSourceAcceptanceRoute, type SourceAcceptanceCommand } from "./source-acceptance-route";
import { registerCandidateClaimAcceptanceRoute, type CandidateClaimAcceptanceCommand } from "./candidate-claim-acceptance-route";
import { registerCandidateClaimAcceptanceContextRoute } from "./candidate-claim-context-route";
import { registerHumanRevisionRoute, type HumanRevisionRouteDependencies } from "./human-revision-route";
import { registerEditorialDraftRoute, type EditorialDraftRouteDependencies } from "./editorial-draft-route";
import { registerEditorialSourceRoute } from "./editorial-source-route";
import { registerEditorialClaimRoute, type EditorialClaimRouteDependencies } from "./editorial-claim-route";
import { registerCurrentUpdateRoute } from "./current-update-route";
import { registerCurrentUpdateSupportRoute } from "./current-update-support-route";
import { registerCurrentUpdateTransitionRoute } from "./current-update-transition-route";

export type PrivateApiDependencies = Readonly<{
  serviceAuthenticator: ServiceCredentialAuthenticator;
  publicCatalogue: PublicCatalogueQuery;
  editorialBriefingTransitions?: EditorialBriefingTransitionCommand;
  preparedProposalAcceptances?: PreparedProposalAcceptanceCommand;
  sourceAcceptances?: SourceAcceptanceCommand;
  candidateClaimAcceptances?: CandidateClaimAcceptanceCommand;
  candidateClaimAcceptanceContexts?: CandidateClaimAcceptanceContextQuery;
  humanRevisions?: HumanRevisionRouteDependencies["humanRevisions"];
  editorialDrafts?: EditorialDraftRouteDependencies["editorialDrafts"];
  editorialSources?: { accept(input: import("@/modules/evidence/accept-editorial-source-command").AcceptEditorialSourceRequest): Promise<unknown> };
  editorialClaims?: EditorialClaimRouteDependencies["editorialClaims"];
  currentUpdates?: Parameters<typeof registerCurrentUpdateRoute>[1]["updates"];
  currentUpdateSupports?: Parameters<typeof registerCurrentUpdateSupportRoute>[1]["supports"];
  currentUpdateTransitions?: Parameters<typeof registerCurrentUpdateTransitionRoute>[1]["transitions"];
  editorialReadModels?: EditorialReadRepository;
  sourceSubmissionReadModels?: SourceSubmissionReadRepository;
  sourceSubmissions?: SourceSubmissionCommand;
  anonymousAnalyticsEvents?: AnonymousAnalyticsEventCommand;
  topicRequests?: TopicRequestCommand;
  now?: () => Date;
}>;

/**
 * The read-only application seam used by anonymous readers. Implementations
 * may query a fixture today and Postgres later, but must never make the HTTP
 * adapter aware of that choice.
 */
export type PublicCatalogueQuery = Readonly<{
  findPublishedBriefingBySlug(slug: string): Promise<PublishedBriefing | undefined> | PublishedBriefing | undefined;
}>;

type ApiErrorBody = Readonly<{
  error: Readonly<{
    code: string;
    message: string;
  }>;
}>;

declare module "fastify" {
  interface FastifyRequest {
    serviceIdentity?: PrivateServiceIdentity;
  }
}

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const unauthorized = () => new ApiError(401, "unauthorized", "A valid service credential is required.");

/**
 * The container-facing HTTP adapter. It contains authentication and transport
 * concerns only; feature use cases cross this boundary through injected ports.
 */
export function buildPrivateApi(dependencies: PrivateApiDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const now = dependencies.now ?? (() => new Date());

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/") || request.url.startsWith("/v1/public/")) {
      return;
    }

    const authorization = request.headers.authorization;
    const identity = await dependencies.serviceAuthenticator.authenticate(
      Array.isArray(authorization) ? authorization[0] : authorization,
    );

    if (!identity) {
      throw unauthorized();
    }

    request.serviceIdentity = identity;
  });

  app.get("/v1/healthz", async () => ({
    status: "ok",
    version: "v1",
    checkedAt: now().toISOString(),
  }));

  app.get<{ Params: { slug: string } }>("/v1/public/briefings/:slug", async (request, reply) => {
    const briefing = await dependencies.publicCatalogue.findPublishedBriefingBySlug(
      request.params.slug,
    );

    // This check keeps a mistaken repository implementation from exposing a
    // draft through the public transport boundary.
    if (!briefing || briefing.status !== "published") {
      return reply
        .code(404)
        .send(errorBody("not_found", "The requested Briefing does not exist."));
    }

    return briefing;
  });

  if (dependencies.anonymousAnalyticsEvents) {
    registerAnonymousAnalyticsEventRoute(app, dependencies.anonymousAnalyticsEvents);
  }

  if (dependencies.editorialBriefingTransitions) {
    registerEditorialTransitionRoute(app, {
      editorialBriefingTransitions: dependencies.editorialBriefingTransitions,
      now,
      invalidRequest: (message) => new ApiError(400, "invalid_request", message),
      rejectedTransition: () =>
        new ApiError(
          422,
          "editorial_transition_rejected",
          "The requested editorial transition cannot be completed.",
        ),
    });
  }

  if (dependencies.preparedProposalAcceptances) {
    registerPreparedProposalAcceptanceRoute(app, {
      preparedProposalAcceptances: dependencies.preparedProposalAcceptances,
      now,
      invalidRequest: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The prepared proposal does not exist."),
      conflict: () =>
        new ApiError(
          409,
          "conflict",
          "The proposal changed or this acceptance conflicts with existing editorial work.",
        ),
      rejected: () =>
        new ApiError(
          422,
          "validation_failed",
          "The prepared proposal cannot be accepted.",
        ),
    });
  }
  if (dependencies.sourceAcceptances) {
    registerSourceAcceptanceRoute(app, {
      sourceAcceptances: dependencies.sourceAcceptances,
      now,
      invalid: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The prepared proposal does not exist."),
      conflict: () => new ApiError(409, "conflict", "The proposal changed or this Source acceptance conflicts with existing evidence."),
      rejected: () => new ApiError(422, "validation_failed", "The Source cannot be accepted from this submission."),
    });
  }
  if (dependencies.candidateClaimAcceptances) {
    registerCandidateClaimAcceptanceRoute(app, { candidateClaimAcceptances: dependencies.candidateClaimAcceptances, now,
      invalid: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The prepared proposal does not exist."),
      conflict: () => new ApiError(409, "conflict", "The proposal changed or this Claim acceptance conflicts with editorial evidence."),
      rejected: () => new ApiError(422, "validation_failed", "The candidate Claim cannot be accepted."), });
  }
  if (dependencies.candidateClaimAcceptanceContexts) {
    registerCandidateClaimAcceptanceContextRoute(app, dependencies.candidateClaimAcceptanceContexts, {
      invalid: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The requested Source Submission does not exist."),
      unavailable: () => new ApiError(422, "validation_failed", "The Source Submission has no reviewable proposal."),
    });
  }
  if (dependencies.humanRevisions) {
    registerHumanRevisionRoute(app, {
      humanRevisions: dependencies.humanRevisions,
      now,
      invalid: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The requested Briefing does not exist."),
      conflict: () => new ApiError(409, "conflict", "The Briefing changed or this revision request conflicts with existing editorial work."),
      rejected: () => new ApiError(422, "validation_failed", "The human Briefing revision cannot be created."),
    });
  }
  if (dependencies.editorialDrafts) registerEditorialDraftRoute(app, { editorialDrafts: dependencies.editorialDrafts, now, invalid: (message) => new ApiError(400, "invalid_request", message), conflict: () => new ApiError(409, "conflict", "The Draft conflicts with existing editorial work."), rejected: () => new ApiError(422, "validation_failed", "The Draft cannot be created.") });
  if (dependencies.editorialSources) registerEditorialSourceRoute(app, { sources: dependencies.editorialSources, now, invalid: (message) => new ApiError(400, "invalid_request", message), conflict: () => new ApiError(409, "conflict", "The Source conflicts with existing evidence."), rejected: () => new ApiError(422, "validation_failed", "The Source cannot be accepted.") });
  if (dependencies.editorialClaims) registerEditorialClaimRoute(app, { editorialClaims: dependencies.editorialClaims, now, invalid: (message) => new ApiError(400, "invalid_request", message), conflict: () => new ApiError(409, "conflict", "The Draft changed or this Claim conflicts with existing editorial evidence."), notFound: () => new ApiError(404, "not_found", "The accepted Source does not exist."), rejected: () => new ApiError(422, "validation_failed", "The Claim cannot be created.") });
  if (dependencies.currentUpdates) registerCurrentUpdateRoute(app, { updates: dependencies.currentUpdates, now, invalid: (message) => new ApiError(400, "invalid_request", message), notFound: () => new ApiError(404, "not_found", "The Briefing does not exist."), conflict: () => new ApiError(409, "conflict", "This Current Update conflicts with existing editorial work."), rejected: () => new ApiError(422, "validation_failed", "The Current Update cannot be created.") });
  if (dependencies.currentUpdateSupports) registerCurrentUpdateSupportRoute(app, { supports: dependencies.currentUpdateSupports, now, invalid: (message) => new ApiError(400, "invalid_request", message), notFound: () => new ApiError(404, "not_found", "The accepted Source does not exist."), conflict: () => new ApiError(409, "conflict", "The Current Update changed or this Source is already attached."), rejected: () => new ApiError(422, "validation_failed", "The Source cannot be attached to this Current Update.") });
  if (dependencies.currentUpdateTransitions) registerCurrentUpdateTransitionRoute(app, { transitions: dependencies.currentUpdateTransitions, now, invalid: (message) => new ApiError(400, "invalid_request", message), notFound: () => new ApiError(404, "not_found", "The Current Update does not exist."), rejected: () => new ApiError(422, "validation_failed", "The Current Update cannot make that editorial transition.") });

  if (dependencies.editorialReadModels) {
    registerEditorialReadRoutes(app, {
      editorialReadModels: dependencies.editorialReadModels,
      invalidRequest: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The requested Briefing does not exist."),
    });
  }
  if (dependencies.sourceSubmissionReadModels) {
    registerSourceSubmissionReadRoutes(app, dependencies.sourceSubmissionReadModels, {
      invalid: (message) => new ApiError(400, "invalid_request", message),
      notFound: () => new ApiError(404, "not_found", "The requested Source Submission does not exist."),
    });
  }

  if (dependencies.sourceSubmissions) {
    registerSourceSubmissionRoute(app, dependencies.sourceSubmissions);
  }

  if (dependencies.topicRequests) {
    registerTopicRequestRoute(app, dependencies.topicRequests);
  }

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorBody("not_found", "The requested endpoint does not exist."));
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
    }

    if (hasErrorCode(error, "FST_ERR_CTP_INVALID_JSON_BODY")) {
      return reply
        .code(400)
        .send(errorBody("invalid_request", "Request body must be valid JSON."));
    }

    return reply
      .code(500)
      .send(errorBody("internal_error", "The private API could not complete the request."));
  });

  return app;
}

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
