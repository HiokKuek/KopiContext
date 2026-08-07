import type { FastifyInstance } from "fastify";
import type { SourceSubmissionReadRepository } from "@/modules/preparation/source-submission-read-model";

export function registerSourceSubmissionReadRoutes(app: FastifyInstance, repository: SourceSubmissionReadRepository, errors: Readonly<{ invalid: (message:string)=>Error; notFound:()=>Error }>): void {
  app.get("/v1/editorial/source-submissions", async () => ({ items: await repository.listSourceSubmissions() }));
  app.get<{ Params: unknown }>("/v1/editorial/source-submissions/:submissionId", async (request) => {
    const id=(request.params as Record<string,unknown>).submissionId;
    if(typeof id!=="string"||!id.trim()||id.length>200) throw errors.invalid("submissionId must be a non-empty string.");
    const item=await repository.getSourceSubmission(id.trim()); if(!item) throw errors.notFound(); return item;
  });
}
