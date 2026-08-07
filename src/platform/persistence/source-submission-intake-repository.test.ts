import { describe, expect, it } from "vitest";

import { sourceSubmissions } from "./schema";

describe("Source Submission intake persistence contract", () => {
  it("uses the existing Source Submission aggregate as a pending worker queue", () => {
    expect(sourceSubmissions.idempotencyKey.name).toBe("idempotency_key");
    expect(sourceSubmissions.processingStatus.name).toBe("processing_status");
    expect(sourceSubmissions.preparationResultState.name).toBe("preparation_result_state");
  });
});
