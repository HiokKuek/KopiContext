import type {
  DuplicateDetectionAdapter,
  PreparationAiAdapter,
  SourcePreparationStore,
  SourceRetrievalAdapter,
} from "@/modules/preparation/source-preparation";
import { prepareSourceSubmission } from "@/modules/preparation/source-preparation";
import { createSourceSubmissionWorker, type SourceSubmissionWorkerQueue } from "@/modules/preparation/source-submission-worker";
import { createPostgresPersistence, type PostgresPersistence } from "@/platform/persistence/postgres";
import { DrizzleSourcePreparationRepository } from "@/platform/persistence/source-preparation-repository";
import { DrizzleSourceSubmissionWorkerQueue } from "@/platform/persistence/source-submission-worker-repository";

import type { SourcePreparationWorkerRuntimeConfig } from "./config";

/** The only provider seam the private worker composition accepts. */
export type SourcePreparationWorkerAdapters = Readonly<{
  retrieval: SourceRetrievalAdapter;
  ai: PreparationAiAdapter;
}>;

export type SourcePreparationWorkerRuntime = Readonly<{
  runOnce: ReturnType<typeof createSourceSubmissionWorker>["runOnce"];
  runUntilStopped(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}>;

type WorkerStore = SourcePreparationStore & DuplicateDetectionAdapter;

type CompositionDependencies = Readonly<{
  adapters?: SourcePreparationWorkerAdapters;
  createPersistence?: (config: SourcePreparationWorkerRuntimeConfig["database"]) => PostgresPersistence;
  createQueue?: (persistence: PostgresPersistence) => SourceSubmissionWorkerQueue;
  createStore?: (persistence: PostgresPersistence) => WorkerStore;
  now?: () => string;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}>;

/**
 * Private process composition for source preparation. It has no Fastify or
 * Next.js dependency, so retrieval and model calls can never be reached from
 * an HTTP request path. Adapters are mandatory and validated by the launcher
 * before this function is called; an absent adapter fails before Postgres is
 * opened and therefore before a job lease can be claimed.
 */
export function composeSourcePreparationWorkerRuntime(
  configuration: SourcePreparationWorkerRuntimeConfig,
  dependencies: CompositionDependencies = {},
): SourcePreparationWorkerRuntime {
  if (!dependencies.adapters) {
    throw new Error("The private source-preparation worker requires reviewed retrieval and AI adapters.");
  }
  const adapters = dependencies.adapters;

  const persistence = (dependencies.createPersistence ?? createPostgresPersistence)(configuration.database);
  const queue = (dependencies.createQueue ?? ((resource) => new DrizzleSourceSubmissionWorkerQueue(resource.db)))(persistence);
  const store = (dependencies.createStore ?? ((resource) => new DrizzleSourcePreparationRepository(resource.db)))(persistence);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const worker = createSourceSubmissionWorker(
    queue,
    {
      prepare: (claim) => prepareSourceSubmission(claim.request, {
        retrieval: adapters.retrieval,
        ai: adapters.ai,
        duplicates: store,
        store,
        clock: { now },
      }),
    },
    {
      workerId: configuration.workerId,
      leaseMs: configuration.leaseMs,
      maxAttempts: configuration.maxAttempts,
      now: () => new Date(now()),
    },
  );
  const sleep = dependencies.sleep ?? waitForPoll;

  return {
    runOnce: worker.runOnce,
    async runUntilStopped(signal) {
      while (!signal.aborted) {
        const result = await worker.runOnce();
        // A claimed job is drained immediately. Polling occurs only while
        // idle, keeping a silent queue quiet without delaying active work.
        if (result.kind === "idle" && !signal.aborted) {
          await sleep(configuration.pollIntervalMs, signal);
        }
      }
    },
    close: () => persistence.close(),
  };
}

function waitForPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
