import { describe, expect, it } from "vitest";

import { loadReviewedSourcePreparationAdapters } from "./adapter-loader";

describe("reviewed source preparation adapter loader", () => {
  it("fails closed when a configured module cannot be loaded", async () => {
    await expect(loadReviewedSourcePreparationAdapters("file:///missing-adapter.ts", async () => {
      throw new Error("missing");
    })).rejects.toThrow("could not be loaded");
  });

  it("rejects a module that lacks the explicit factory contract", async () => {
    await expect(loadReviewedSourcePreparationAdapters("file:///bad-adapter.ts", async () => ({}))).rejects.toThrow(
      "must export createSourcePreparationAdapters",
    );
  });

  it("rejects adapters without both retrieval and AI ports", async () => {
    await expect(loadReviewedSourcePreparationAdapters("file:///bad-adapter.ts", async () => ({
      createSourcePreparationAdapters: () => ({ retrieval: {} } as never),
    }))).rejects.toThrow("returned invalid adapters");
  });
});
