import { describe, expect, it } from "vitest";

describe("Auth.js route", () => {
  it("can be imported without editor configuration so public builds stay independent", async () => {
    const names = ["EDITOR_ALLOWED_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    try {
      for (const name of names) {
        delete process.env[name];
      }
      await expect(import("./route")).resolves.toMatchObject({ runtime: "nodejs" });
    } finally {
      for (const name of names) {
        const value = previous[name];
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});
