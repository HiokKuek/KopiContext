import Fastify, { type FastifyInstance } from "fastify";

import {
  type PrivateServiceIdentity,
  type ServiceCredentialAuthenticator,
} from "./service-auth";

export type PrivateApiDependencies = Readonly<{
  serviceAuthenticator: ServiceCredentialAuthenticator;
  now?: () => Date;
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
 * concerns only; feature modules are deliberately not imported here yet.
 */
export function buildPrivateApi(dependencies: PrivateApiDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const now = dependencies.now ?? (() => new Date());

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/")) {
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

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorBody("not_found", "The requested endpoint does not exist."));
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
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
