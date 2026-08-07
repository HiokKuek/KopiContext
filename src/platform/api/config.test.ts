import { describe, expect, it } from "vitest";

import { privateApiRuntimeConfigFromEnvironment } from "./config";

describe("private API runtime configuration", () => {
  it("fails closed in production when the database connection is absent", () => {
    expect(() =>
      privateApiRuntimeConfigFromEnvironment(environment({
        PRIVATE_API_SERVICE_CREDENTIAL: "production-secret",
      })),
    ).toThrow("DATABASE_URL");
  });

  it("composes production settings only when the private database is explicit", () => {
    expect(
      privateApiRuntimeConfigFromEnvironment(environment({
        PRIVATE_API_SERVICE_CREDENTIAL: "production-secret",
        DATABASE_URL: "postgres://api:secret@127.0.0.1:5432/kopi_context",
      })),
    ).toMatchObject({
      mode: "production",
      database: { connectionString: "postgres://api:secret@127.0.0.1:5432/kopi_context" },
    });
  });

  it("allows fixture-backed local development only when it is explicitly selected", () => {
    expect(
      privateApiRuntimeConfigFromEnvironment(environment({
        PRIVATE_API_RUNTIME_MODE: "local-development",
        PRIVATE_API_SERVICE_CREDENTIAL: "local-secret",
      })),
    ).toMatchObject({ mode: "local-development" });
  });

  it("rejects a database configuration in local development mode", () => {
    expect(() =>
      privateApiRuntimeConfigFromEnvironment(environment({
        PRIVATE_API_RUNTIME_MODE: "local-development",
        PRIVATE_API_SERVICE_CREDENTIAL: "local-secret",
        DATABASE_URL: "postgres://api:secret@127.0.0.1:5432/kopi_context",
      })),
    ).toThrow("must not be set in local-development mode");
  });

  it("rejects an unknown runtime mode", () => {
    expect(() =>
      privateApiRuntimeConfigFromEnvironment(environment({
        PRIVATE_API_RUNTIME_MODE: "preview",
        PRIVATE_API_SERVICE_CREDENTIAL: "local-secret",
      })),
    ).toThrow("PRIVATE_API_RUNTIME_MODE");
  });
});

function environment(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}
