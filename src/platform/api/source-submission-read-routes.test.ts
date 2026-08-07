import { describe, expect, it } from "vitest";
import { buildPrivateApi } from "./app";

describe("Source Submission editorial read routes", () => {
  it("requires service auth and exposes a minimised queue", async () => {
    const app=buildPrivateApi({serviceAuthenticator:{async authenticate(value){return value==="Bearer ok"?{kind:"private-service"}:null;}},publicCatalogue:{findPublishedBriefingBySlug(){return undefined;}},sourceSubmissionReadModels:{async listSourceSubmissions(){return [{id:"a",kind:"transcript",originalIdentifier:"ref",submittedAt:"2026-08-07T10:00:00.000Z",processingStatus:"submitted",attemptCount:0}];},async getSourceSubmission(){return undefined;}}});
    const denied=await app.inject({method:"GET",url:"/v1/editorial/source-submissions"}); expect(denied.statusCode).toBe(401);
    const allowed=await app.inject({method:"GET",url:"/v1/editorial/source-submissions",headers:{authorization:"Bearer ok"}}); expect(allowed.json()).toEqual({items:[{id:"a",kind:"transcript",originalIdentifier:"ref",submittedAt:"2026-08-07T10:00:00.000Z",processingStatus:"submitted",attemptCount:0}]}); await app.close();
  });
  it("returns a prepared-output fingerprint on a detail response without worker internals", async () => {
    const app=buildPrivateApi({serviceAuthenticator:{async authenticate(){return {kind:"private-service"};}},publicCatalogue:{findPublishedBriefingBySlug(){return undefined;}},sourceSubmissionReadModels:{async listSourceSubmissions(){return [];},async getSourceSubmission(){return {id:"a",kind:"transcript",originalIdentifier:"ref",submittedBy:"google:1",submittedAt:"2026-08-07T10:00:00.000Z",rightsNote:"rights",processingStatus:"ready-for-review",resultState:"prepared",preparedOutputFingerprint:"sha256:abc",proposal:{proposedTopic:"Topic",confidence:.9,rationale:"r",candidateClaims:[],draft:{templateVersion:"v1",title:"Draft",sections:[]}}};}}});
    const response=await app.inject({method:"GET",url:"/v1/editorial/source-submissions/a",headers:{authorization:"Bearer ok"}});
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({preparedOutputFingerprint:"sha256:abc"}); expect(JSON.stringify(response.json())).not.toContain("processingLease"); await app.close();
  });
});
