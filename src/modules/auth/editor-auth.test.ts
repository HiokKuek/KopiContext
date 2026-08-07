import { describe, expect, it } from "vitest";

import {
  EditorAccessDeniedError,
  EditorAuthConfigurationError,
  EditorAuthenticationRequiredError,
  createEditorAuthOptions,
  isAllowedGoogleProfile,
  readEditorAuthConfiguration,
  requireEditorIdentity,
} from "./editor-auth";

const environment = {
  EDITOR_ALLOWED_EMAIL: "  Editor@Example.com ",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  NEXTAUTH_SECRET: "a-long-random-secret",
  NEXTAUTH_URL: "https://kopi.example.test",
};

describe("editor authentication configuration", () => {
  it("normalises the single allowed editor email without exposing configuration at module load", () => {
    expect(readEditorAuthConfiguration(environment)).toMatchObject({
      allowedEmail: "editor@example.com",
      googleClientId: "google-client-id",
      nextAuthUrl: "https://kopi.example.test",
    });
  });

  it("fails closed for incomplete, malformed, and multi-value configuration", () => {
    expect(() => readEditorAuthConfiguration({ ...environment, GOOGLE_CLIENT_SECRET: "" })).toThrow(
      EditorAuthConfigurationError,
    );
    expect(() => readEditorAuthConfiguration({ ...environment, EDITOR_ALLOWED_EMAIL: "a@example.com,b@example.com" })).toThrow(
      "exactly one valid editor email",
    );
    expect(() => readEditorAuthConfiguration({ ...environment, NEXTAUTH_URL: "http://kopi.example.test" })).toThrow(
      "absolute HTTPS URL",
    );
  });

  it("uses Google only and admits only the verified configured account", () => {
    const options = createEditorAuthOptions(environment);
    expect(options.providers).toHaveLength(1);
    expect(options.providers[0]?.id).toBe("google");
    expect(isAllowedGoogleProfile({ email: "EDITOR@example.com", email_verified: true }, "editor@example.com")).toBe(true);
    expect(isAllowedGoogleProfile({ email: "editor@example.com", email_verified: false }, "editor@example.com")).toBe(false);
    expect(isAllowedGoogleProfile({ email: "another@example.com", email_verified: true }, "editor@example.com")).toBe(false);
  });
});

describe("EditorIdentity boundary", () => {
  const configuration = { allowedEmail: "editor@example.com" };

  it("derives an immutable audit actor from the trusted Google subject", () => {
    expect(requireEditorIdentity({ user: { email: "Editor@Example.com", id: "113355779900" }, expires: "never" }, configuration)).toEqual({
      actorId: "google:113355779900",
      email: "editor@example.com",
    });
  });

  it("rejects missing sessions, unapproved addresses, and sessions without a stable subject", () => {
    expect(() => requireEditorIdentity(null, configuration)).toThrow(EditorAuthenticationRequiredError);
    expect(() => requireEditorIdentity({ user: { email: "other@example.com", id: "113355779900" }, expires: "never" }, configuration)).toThrow(EditorAccessDeniedError);
    expect(() => requireEditorIdentity({ user: { email: "editor@example.com" }, expires: "never" }, configuration)).toThrow(
      "stable Google identity",
    );
  });
});
