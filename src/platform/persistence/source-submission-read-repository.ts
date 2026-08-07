import { asc, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SourceSubmissionReadRepository, SourceSubmissionReview } from "@/modules/preparation/source-submission-read-model";
import { sourceSubmissions } from "./schema";

/** Editor-only projection: excludes raw text, fingerprints, prompts, leases, retries and worker errors. */
export class DrizzleSourceSubmissionReadRepository implements SourceSubmissionReadRepository {
  constructor(private readonly db: NodePgDatabase) {}
  async listSourceSubmissions() {
    const rows = await this.db.select({ id: sourceSubmissions.id, kind: sourceSubmissions.kind, originalIdentifier: sourceSubmissions.originalIdentifier, submittedAt: sourceSubmissions.submittedAt, processingStatus: sourceSubmissions.processingStatus, attemptCount: sourceSubmissions.processingAttemptCount }).from(sourceSubmissions).orderBy(asc(sourceSubmissions.processingStatus), desc(sourceSubmissions.submittedAt));
    return rows.map((row) => ({ ...row, submittedAt: row.submittedAt.toISOString() }));
  }
  async getSourceSubmission(id: string): Promise<SourceSubmissionReview | undefined> {
    const [row] = await this.db.select().from(sourceSubmissions).where(eq(sourceSubmissions.id, id)).limit(1);
    if (!row) return undefined;
    const output = proposal(row.processorOutput);
    return { id: row.id, kind: row.kind, originalIdentifier: row.originalIdentifier, submittedBy: row.submittedBy, submittedAt: row.submittedAt.toISOString(), rightsNote: row.rightsNote, processingStatus: row.processingStatus, ...(row.preparationResultState ? { resultState: row.preparationResultState } : {}), ...(row.retrievedAt ? { retrievedAt: row.retrievedAt.toISOString() } : {}), ...(row.processorOutput ? { preparedOutputFingerprint: fingerprint(row.processorOutput) } : {}), ...(output ? { proposal: output } : {}) };
  }
}
function proposal(value: unknown): SourceSubmissionReview["proposal"] | undefined {
  if (!record(value) || !record(value.classification) || !record(value.draft) || !Array.isArray(value.candidateClaims)) return undefined;
  const c=value.classification,d=value.draft;
  if (typeof c.proposedTopic!=="string"||typeof c.confidence!=="number"||typeof c.rationale!=="string"||typeof d.templateVersion!=="string"||typeof d.title!=="string"||!Array.isArray(d.sections)) return undefined;
  const claims=value.candidateClaims.filter(record).filter(x=>typeof x.statement==="string"&&typeof x.excerpt==="string"&&typeof x.confidence==="number"&&typeof x.rationale==="string").map(x=>({statement:x.statement as string,excerpt:x.excerpt as string,confidence:x.confidence as number,rationale:x.rationale as string}));
  const sections=d.sections.filter(record).filter(x=>typeof x.section==="string"&&typeof x.body==="string").map(x=>({section:x.section as string,body:x.body as string}));
  return {proposedTopic:c.proposedTopic, ...(typeof c.proposedSubtopic==="string"?{proposedSubtopic:c.proposedSubtopic}:{}),confidence:c.confidence,rationale:c.rationale,candidateClaims:claims,draft:{templateVersion:d.templateVersion,title:d.title,sections}};
}
function record(value: unknown): value is Record<string,unknown> { return typeof value==="object"&&value!==null&&!Array.isArray(value); }
function fingerprint(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
