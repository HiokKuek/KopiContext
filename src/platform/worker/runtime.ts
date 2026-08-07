import { loadReviewedSourcePreparationAdapters } from "./adapter-loader";
import { sourcePreparationWorkerConfigFromEnvironment } from "./config";
import { composeSourcePreparationWorkerRuntime } from "./runtime-composition";

void main().catch((error: unknown) => {
  // Configuration and adapter-loader failures are intentionally generic and
  // never include provider material or credentials.
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const configuration = sourcePreparationWorkerConfigFromEnvironment();
  const adapters = await loadReviewedSourcePreparationAdapters(configuration.adapterModule);
  const runtime = composeSourcePreparationWorkerRuntime(configuration, { adapters });
  const abortController = new AbortController();

  function requestShutdown() {
    abortController.abort();
  }

  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  try {
    await runtime.runUntilStopped(abortController.signal);
  } finally {
    await runtime.close();
  }
}
