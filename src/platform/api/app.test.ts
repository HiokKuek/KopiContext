import { afterEach, describe, expect, it } from "vitest";

import { buildPrivateApi } from "./app";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test-credential" ? { kind: "private-service" } : null;
  },
};

describe("private application API", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp() {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      now: () => new Date("2026-08-07T09:30:00.000Z"),
    });
    apps.push(app);
    return app;
  }

  it("returns the versioned health contract to an authenticated private service", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/healthz",
      headers: { authorization: "Bearer test-credential" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      version: "v1",
      checkedAt: "2026-08-07T09:30:00.000Z",
    });
  });

  it("rejects every versioned endpoint without a valid service credential", async () => {
    const response = await createApp().inject({ method: "GET", url: "/v1/healthz" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "unauthorized", message: "A valid service credential is required." },
    });
  });

  it("uses the stable error envelope for unknown endpoints", async () => {
    const response = await createApp().inject({ method: "GET", url: "/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: "The requested endpoint does not exist." },
    });
  });
});
