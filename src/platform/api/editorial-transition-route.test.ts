import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateApi, type PublicCatalogueQuery } from "./app";
import type {
  EditorialBriefingTransitionCommand,
  EditorialBriefingTransitionInput,
} from "./editorial-transition-route";
import type { ServiceCredentialAuthenticator } from "./service-auth";

const acceptedAuthenticator: ServiceCredentialAuthenticator = {
  async authenticate(authorization) {
    return authorization === "Bearer test-credential" ? { kind: "private-service" } : null;
  },
};

const publicCatalogue: PublicCatalogueQuery = {
  findPublishedBriefingBySlug: () => undefined,
};

describe("editorial transition private API route", () => {
  const apps: ReturnType<typeof buildPrivateApi>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function createApp(command: EditorialBriefingTransitionCommand) {
    const app = buildPrivateApi({
      serviceAuthenticator: acceptedAuthenticator,
      publicCatalogue,
      editorialBriefingTransitions: command,
      now: () => new Date("2026-08-07T10:00:00.000Z"),
    });
    apps.push(app);
    return app;
  }

  it("passes a validated, server-timestamped transition to the injected application command", async () => {
    const transition = vi.fn<(input: EditorialBriefingTransitionInput) => Promise<{
      ok: true;
      briefingId: string;
      revisionId: string;
      status: "needs-verification";
      audit: { from: "draft"; to: "needs-verification"; actorId: string; occurredAt: string };
    }>>().mockResolvedValue({
      ok: true,
      briefingId: "briefing-1",
      revisionId: "revision-1",
      status: "needs-verification",
      audit: {
        from: "draft",
        to: "needs-verification",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      },
    });
    const response = await createApp({ transition }).inject({
      method: "POST",
      url: "/v1/editorial/briefings/briefing-1/transitions",
      headers: { authorization: "Bearer test-credential" },
      payload: { to: "needs-verification", actorId: " editor-1 " },
    });

    expect(response.statusCode).toBe(200);
    expect(transition).toHaveBeenCalledWith({
      briefingId: "briefing-1",
      to: "needs-verification",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:00:00.000Z",
    });
    expect(response.json()).toEqual({
      briefingId: "briefing-1",
      revisionId: "revision-1",
      status: "needs-verification",
      audit: {
        from: "draft",
        to: "needs-verification",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      },
    });
  });

  it("requires the private service credential before it invokes a transition command", async () => {
    const transition = vi.fn();
    const response = await createApp({ transition }).inject({
      method: "POST",
      url: "/v1/editorial/briefings/briefing-1/transitions",
      payload: { to: "needs-verification", actorId: "editor-1" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "unauthorized", message: "A valid service credential is required." },
    });
    expect(transition).not.toHaveBeenCalled();
  });

  it("rejects malformed commands with the stable invalid-request envelope", async () => {
    const transition = vi.fn();
    const response = await createApp({ transition }).inject({
      method: "POST",
      url: "/v1/editorial/briefings/briefing-1/transitions",
      headers: { authorization: "Bearer test-credential" },
      payload: { to: "published", actorId: "editor-1", occurredAt: "client-controlled" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "invalid_request", message: "Request body contains an unsupported field." },
    });
    expect(transition).not.toHaveBeenCalled();
  });

  it("does not expose domain failure details when the command rejects a transition", async () => {
    const response = await createApp({
      transition: () => ({ ok: false, reason: "publication-requires-supported-claims" }),
    }).inject({
      method: "POST",
      url: "/v1/editorial/briefings/briefing-1/transitions",
      headers: { authorization: "Bearer test-credential" },
      payload: { to: "published", actorId: "editor-1" },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: "editorial_transition_rejected",
        message: "The requested editorial transition cannot be completed.",
      },
    });
  });
});
