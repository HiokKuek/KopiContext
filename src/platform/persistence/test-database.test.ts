import { describe, expect, it } from "vitest";

import { testPostgresConnectionConfigFromEnvironment } from "./test-database";

describe("testPostgresConnectionConfigFromEnvironment", () => {
  it("requires TEST_DATABASE_URL and never falls back to DATABASE_URL", () => {
    expect(() =>
      testPostgresConnectionConfigFromEnvironment({
        DATABASE_URL: "postgres://app:secret@localhost:5432/kopi_context",
      }),
    ).toThrow("TEST_DATABASE_URL");
  });

  it("accepts an explicitly named dedicated test database", () => {
    expect(
      testPostgresConnectionConfigFromEnvironment({
        TEST_DATABASE_URL: "postgres://test:secret@localhost:5432/kopi_context_test",
      }),
    ).toEqual({
      connectionString: "postgres://test:secret@localhost:5432/kopi_context_test",
      maxConnections: 1,
    });
  });

  it("rejects an unsafe database name and a production connection reused as test", () => {
    expect(() =>
      testPostgresConnectionConfigFromEnvironment({
        TEST_DATABASE_URL: "postgres://test:secret@localhost:5432/kopi_context",
      }),
    ).toThrow("dedicated test database");

    expect(() =>
      testPostgresConnectionConfigFromEnvironment({
        DATABASE_URL: "postgres://app:secret@localhost:5432/kopi_context_test",
        TEST_DATABASE_URL: "postgres://test:other-secret@localhost:5432/kopi_context_test",
      }),
    ).toThrow("same database");
  });
});
