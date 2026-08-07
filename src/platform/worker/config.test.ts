import { describe, expect, it } from "vitest";

import { sourcePreparationWorkerConfigFromEnvironment } from "./config";

describe("source preparation worker configuration", () => {
  const base = {
    DATABASE_URL: "postgres://worker:secret@127.0.0.1:5432/kopi_context",
    SOURCE_PREPARATION_WORKER_ID: "source-preparation-a",
    SOURCE_PREPARATION_ADAPTER_MODULE: "file:///app/src/platform/worker/adapters/reviewed-provider.ts",
  };

  it("requires an explicit reviewed adapter module before it can start", () => {
    const { SOURCE_PREPARATION_ADAPTER_MODULE: _adapter, ...withoutAdapter } = base;

    expect(() => sourcePreparationWorkerConfigFromEnvironment(environment(withoutAdapter))).toThrow(
      "SOURCE_PREPARATION_ADAPTER_MODULE",
    );
  });

  it("rejects an unbounded or public-style module specifier", () => {
    expect(() => sourcePreparationWorkerConfigFromEnvironment(environment({
      ...base,
      SOURCE_PREPARATION_ADAPTER_MODULE: "https://provider.example/adapter.mjs",
    }))).toThrow("file URL");
  });

  it("reads bounded private worker settings", () => {
    expect(sourcePreparationWorkerConfigFromEnvironment(environment({
      ...base,
      SOURCE_PREPARATION_WORKER_POLL_INTERVAL_MS: "1200",
      SOURCE_PREPARATION_WORKER_LEASE_MS: "90000",
      SOURCE_PREPARATION_WORKER_MAX_ATTEMPTS: "4",
    }))).toMatchObject({
      database: { connectionString: base.DATABASE_URL },
      workerId: "source-preparation-a",
      adapterModule: base.SOURCE_PREPARATION_ADAPTER_MODULE,
      pollIntervalMs: 1200,
      leaseMs: 90000,
      maxAttempts: 4,
    });
  });
});

function environment(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}
