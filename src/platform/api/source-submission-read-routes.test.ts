import { describe, expect, it } from "vitest";
import { buildPrivateApi } from "./app";

describe("Source Submission editorial read routes", () => {
  it("requires service auth and exposes a minimised queue", async () => {
    const app=buildPrivateApi({serviceAuthenticator:{async authenticate(value){return value==="Bearer ok"?{kind:"private-service"}:null;}},publicCatalogue:{findPublishedBriefingBySlug(){return undefined;}},sourceSubmissionReadModels:{async listSourceSubmissions(){return [{id:"a",kind:"transcript",originalIdentifier:"ref",submittedAt:"2026-08-07T10:00:00.000Z",processingStatus:"submitted",attemptCount:0}];},async getSourceSubmission(){return undefined;}}});
    const denied=await app.inject({method:"GET",url:"/v1/editorial/source-submissions"}); expect(denied.statusCode).toBe(401);
    const allowed=await app.inject({method:"GET",url:"/v1/editorial/source-submissions",headers:{authorization:"Bearer ok"}}); expect(allowed.json()).toEqual({items:[{id:"a",kind:"transcript",originalIdentifier:"ref",submittedAt:"2026-08-07T10:00:00.000Z",processingStatus:"submitted",attemptCount:0}]}); await app.close();
  });
});
