import type { FastifyInstance } from "fastify";

import { getPublishedBriefingBySlug } from "@/modules/content/published-briefings";
import { createTopicRequestCommand } from "@/modules/discovery/topic-request-command";
import { createEditorialWorkflowCommand } from "@/modules/editorial/editorial-workflow-command";
import { createAcceptPreparedProposalCommand } from "@/modules/editorial/accept-prepared-proposal-command";
import { createAcceptSourceFromSubmissionCommand } from "@/modules/evidence/accept-source-from-submission-command";
import { createAcceptCandidateClaimCommand } from "@/modules/evidence/accept-candidate-claim-command";
import { createSourceSubmissionIntakeCommand } from "@/modules/preparation/source-submission-intake";
import {
  DrizzleEditorialRepository,
  DrizzlePublishedCatalogueRepository,
} from "@/platform/persistence/content-repositories";
import { DrizzleEditorialReadRepository } from "@/platform/persistence/editorial-read-repository";
import { DrizzleTopicRequestDemandRepository } from "@/platform/persistence/topic-request-repository";
import { DrizzleAnonymousAnalyticsRepository } from "@/platform/persistence/anonymous-analytics-repository";
import { DrizzleSourceSubmissionIntakeRepository } from "@/platform/persistence/source-submission-intake-repository";
import { DrizzleSourceSubmissionReadRepository } from "@/platform/persistence/source-submission-read-repository";
import { DrizzleAcceptPreparedProposalRepository } from "@/platform/persistence/accept-prepared-proposal-repository";
import { DrizzleAcceptSourceFromSubmissionRepository } from "@/platform/persistence/accept-source-from-submission-repository";
import { DrizzleAcceptCandidateClaimRepository } from "@/platform/persistence/accept-candidate-claim-repository";
import { DrizzleCandidateClaimAcceptanceContextRepository } from "@/platform/persistence/candidate-claim-acceptance-context-repository";
import { DrizzleHumanRevisionRepository } from "@/platform/persistence/human-revision-repository";
import { createHumanRevisionCommand } from "@/modules/editorial/create-human-revision-command";
import { createEditorialDraftCommand } from "@/modules/editorial/create-editorial-draft-command";
import { DrizzleCreateEditorialDraftRepository } from "@/platform/persistence/create-editorial-draft-repository";
import { createAcceptEditorialSourceCommand } from "@/modules/evidence/accept-editorial-source-command";
import { DrizzleAcceptEditorialSourceRepository } from "@/platform/persistence/accept-editorial-source-repository";
import { createEditorialClaimCommand } from "@/modules/evidence/create-editorial-claim-command";
import { DrizzleCreateEditorialClaimRepository } from "@/platform/persistence/create-editorial-claim-repository";
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
  const preparedProposalAcceptances = new DrizzleAcceptPreparedProposalRepository(persistence.db);
  const sourceAcceptances = new DrizzleAcceptSourceFromSubmissionRepository(persistence.db);
  const candidateClaimAcceptances = new DrizzleAcceptCandidateClaimRepository(persistence.db);
  const candidateClaimAcceptanceContexts = new DrizzleCandidateClaimAcceptanceContextRepository(persistence.db);
  const topicRequestDemands = new DrizzleTopicRequestDemandRepository(persistence.db);
  const sourceSubmissionIntake = new DrizzleSourceSubmissionIntakeRepository(persistence.db);
  const anonymousAnalyticsEvents = new DrizzleAnonymousAnalyticsRepository(persistence.db);
  const app = buildPrivateApi({
    serviceAuthenticator: authenticator,
    publicCatalogue: new DrizzlePublishedCatalogueRepository(persistence.db),
    editorialBriefingTransitions: createEditorialWorkflowCommand(editorialRepository),
    preparedProposalAcceptances: createAcceptPreparedProposalCommand(preparedProposalAcceptances),
    sourceAcceptances: createAcceptSourceFromSubmissionCommand(sourceAcceptances),
    candidateClaimAcceptances: createAcceptCandidateClaimCommand(candidateClaimAcceptances),
    candidateClaimAcceptanceContexts,
    humanRevisions: createHumanRevisionCommand(new DrizzleHumanRevisionRepository(persistence.db)),
    editorialDrafts: createEditorialDraftCommand(new DrizzleCreateEditorialDraftRepository(persistence.db)),
    editorialSources: createAcceptEditorialSourceCommand(new DrizzleAcceptEditorialSourceRepository(persistence.db)),
    editorialClaims: createEditorialClaimCommand(new DrizzleCreateEditorialClaimRepository(persistence.db)),
    sourceSubmissions: createSourceSubmissionIntakeCommand(sourceSubmissionIntake),
    sourceSubmissionReadModels: new DrizzleSourceSubmissionReadRepository(persistence.db),
    editorialReadModels: new DrizzleEditorialReadRepository(persistence.db),
    topicRequests: createTopicRequestCommand(topicRequestDemands),
    anonymousAnalyticsEvents,
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
