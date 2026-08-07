import { describe, expect, it, vi } from "vitest";

import { composePrivateApiRuntime } from "./runtime-composition";
import type { PrivateApiRuntimeConfig } from "./config";

const serviceCredential = "runtime-test-credential";

describe("private API runtime composition", () => {
  it("uses real persistence adapters in production and closes the pool with Fastify", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const createPersistence = vi.fn(() => ({ db: {} as never, close }));
    const runtime = composePrivateApiRuntime(
      productionConfig(),
      { createPersistence },
    );

    expect(createPersistence).toHaveBeenCalledWith(productionConfig().database);

    const health = await runtime.app.inject({
      method: "GET",
      url: "/v1/healthz",
      headers: { authorization: `Bearer ${serviceCredential}` },
    });
    expect(health.statusCode).toBe(200);

    await runtime.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses reader fixtures only in explicitly selected local development mode", async () => {
    const createPersistence = vi.fn();
    const runtime = composePrivateApiRuntime(
      {
        mode: "local-development",
        host: "127.0.0.1",
        port: 3001,
        serviceCredential,
      },
      { createPersistence },
    );

    const response = await runtime.app.inject({
      method: "GET",
      url: "/v1/public/briefings/how-singapores-government-works",
    });

    expect(response.statusCode).toBe(200);
    expect(createPersistence).not.toHaveBeenCalled();
    await runtime.close();
  });
});

function productionConfig(): Extract<PrivateApiRuntimeConfig, { mode: "production" }> {
  return {
    mode: "production",
    host: "127.0.0.1",
    port: 3001,
    serviceCredential,
    database: { connectionString: "postgres://api:secret@127.0.0.1:5432/kopi_context" },
  };
}
