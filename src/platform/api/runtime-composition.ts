import type { FastifyInstance } from "fastify";

import { getPublishedBriefingBySlug } from "@/modules/content/published-briefings";
import { createEditorialWorkflowCommand } from "@/modules/editorial/editorial-workflow-command";
import {
  DrizzleEditorialRepository,
  DrizzlePublishedCatalogueRepository,
} from "@/platform/persistence/content-repositories";
import {
  createPostgresPersistence,
  type PostgresPersistence,
} from "@/platform/persistence/postgres";

import { buildPrivateApi } from "./app";
import type { PrivateApiRuntimeConfig } from "./config";
import { serviceCredentialAuthenticator } from "./service-auth";

export type PrivateApiRuntime = Readonly<{
  app: FastifyInstance;
  close(): Promise<void>;
}>;

// Keep the injected persistence factory's public type small: the full runtime
// owns selection of a production database config, while tests only need to
// substitute the resource lifecycle adapter.
type ProductionPersistenceFactory = (
  config: Extract<PrivateApiRuntimeConfig, { mode: "production" }>["database"],
) => PostgresPersistence;

type RuntimeCompositionDependencies = Readonly<{
  createPersistence?: ProductionPersistenceFactory;
}>;

/**
 * Constructs the HTTP adapter and its long-lived resources for one selected
 * runtime mode. It never selects a fixture or a provider implicitly:
 * production receives real Postgres adapters, while local development keeps
 * only the checked-in reader fixture for UI/API work.
 */
export function composePrivateApiRuntime(
  configuration: PrivateApiRuntimeConfig,
  dependencies: RuntimeCompositionDependencies = {},
): PrivateApiRuntime {
  const authenticator = serviceCredentialAuthenticator(configuration.serviceCredential);

  if (configuration.mode === "local-development") {
    const app = buildPrivateApi({
      serviceAuthenticator: authenticator,
      publicCatalogue: { findPublishedBriefingBySlug: getPublishedBriefingBySlug },
    });

    return { app, close: () => app.close() };
  }

  const persistence = (dependencies.createPersistence ?? createPostgresPersistence)(
    configuration.database,
  );
  const editorialRepository = new DrizzleEditorialRepository(persistence.db);
  const app = buildPrivateApi({
    serviceAuthenticator: authenticator,
    publicCatalogue: new DrizzlePublishedCatalogueRepository(persistence.db),
    editorialBriefingTransitions: createEditorialWorkflowCommand(editorialRepository),
  });

  return {
    app,
    async close() {
      try {
        await app.close();
      } finally {
        await persistence.close();
      }
    },
  };
}
