import type { PreparationAiAdapter, SourceRetrievalAdapter } from "@/modules/preparation/source-preparation";

import type { SourcePreparationWorkerAdapters } from "./runtime-composition";

type AdapterModule = Readonly<{
  createSourcePreparationAdapters?: () => SourcePreparationWorkerAdapters | Promise<SourcePreparationWorkerAdapters>;
}>;

type ModuleImporter = (moduleUrl: string) => Promise<AdapterModule>;

/**
 * Loads an operator-selected adapter only after worker configuration has
 * restricted it to a local, image-packaged file URL. This helper deliberately
 * has no fallback provider or local-development placeholder.
 */
export async function loadReviewedSourcePreparationAdapters(
  moduleUrl: string,
  importer: ModuleImporter = (url) => import(url) as Promise<AdapterModule>,
): Promise<SourcePreparationWorkerAdapters> {
  let loaded: AdapterModule;
  try {
    loaded = await importer(moduleUrl);
  } catch {
    throw new Error("The reviewed source-preparation adapter module could not be loaded; no jobs were claimed.");
  }

  if (typeof loaded.createSourcePreparationAdapters !== "function") {
    throw new Error("The reviewed source-preparation adapter module must export createSourcePreparationAdapters; no jobs were claimed.");
  }

  const adapters = await loaded.createSourcePreparationAdapters();
  if (!isRetrievalAdapter(adapters?.retrieval) || !isAiAdapter(adapters?.ai)) {
    throw new Error("The reviewed source-preparation adapter module returned invalid adapters; no jobs were claimed.");
  }
  return adapters;
}

function isRetrievalAdapter(value: unknown): value is SourceRetrievalAdapter {
  return typeof value === "object" && value !== null && typeof (value as SourceRetrievalAdapter).retrieve === "function";
}

function isAiAdapter(value: unknown): value is PreparationAiAdapter {
  return typeof value === "object" && value !== null && typeof (value as PreparationAiAdapter).prepare === "function";
}
