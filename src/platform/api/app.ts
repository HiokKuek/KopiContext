import Fastify, { type FastifyInstance } from "fastify";

import type { PublishedBriefing } from "@/modules/content/published-briefings";

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

export type PrivateApiDependencies = Readonly<{
  serviceAuthenticator: ServiceCredentialAuthenticator;
  publicCatalogue: PublicCatalogueQuery;
  editorialBriefingTransitions?: EditorialBriefingTransitionCommand;
  sourceSubmissions?: SourceSubmissionCommand;
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

  if (dependencies.sourceSubmissions) {
    registerSourceSubmissionRoute(app, dependencies.sourceSubmissions);
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
