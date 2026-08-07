import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AcceptCandidateClaimRepository, AcceptCandidateClaimRequest, PreparedCandidateClaims } from "@/modules/evidence/accept-candidate-claim-command";
import { fingerprintProposalOutput } from "@/modules/editorial/accept-prepared-proposal-command";
import { mapPersistedSourcePreparation } from "./source-preparation-repository";
import { acceptedSources, briefingRevisions, claimSupports, claims, proposalDecisionRecords, sourceSubmissions } from "./schema";

export class DrizzleAcceptCandidateClaimRepository implements AcceptCandidateClaimRepository {
 constructor(private readonly db:NodePgDatabase){}
 async retrievePreparedCandidateClaims(submissionId:string):Promise<PreparedCandidateClaims|undefined>{const [row]=await this.db.select().from(sourceSubmissions).where(eq(sourceSubmissions.id,submissionId)).limit(1);return row?prepared(row):undefined;}
 async acceptCandidateClaim(request:AcceptCandidateClaimRequest & Readonly<{candidate:PreparedCandidateClaims["candidateClaims"][number]}>){return this.db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${request.idempotencyKey}))`);
  const [old]=await tx.select({id:proposalDecisionRecords.id,submissionId:proposalDecisionRecords.sourceSubmissionId,fingerprint:proposalDecisionRecords.proposalOutputFingerprint,claimId:proposalDecisionRecords.claimId,claimSupportId:proposalDecisionRecords.claimSupportId}).from(proposalDecisionRecords).where(eq(proposalDecisionRecords.idempotencyKey,request.idempotencyKey)).limit(1);
  if(old){if(old.submissionId!==request.submissionId||old.fingerprint!==request.expectedOutputFingerprint||!old.claimId||!old.claimSupportId)return {kind:"idempotency-conflict" as const};return {kind:"idempotent" as const,claimId:old.claimId,claimSupportId:old.claimSupportId,decisionId:old.id};}
  await tx.execute(sql`select ${sourceSubmissions.id} from ${sourceSubmissions} where ${sourceSubmissions.id}=${request.submissionId} for update`);
  const [source]=await tx.select().from(sourceSubmissions).where(eq(sourceSubmissions.id,request.submissionId)).limit(1); const current=source?prepared(source):undefined;
  if(!current||current.outputFingerprint!==request.expectedOutputFingerprint||JSON.stringify(current.candidateClaims[request.candidateIndex])!==JSON.stringify(request.candidate))return {kind:"proposal-conflict" as const};
  const [[revision],[accepted]] = await Promise.all([tx.select({id:briefingRevisions.id,briefingId:briefingRevisions.briefingId}).from(briefingRevisions).where(and(eq(briefingRevisions.id,request.briefingRevisionId),eq(briefingRevisions.templateVersion,"v1"))).limit(1),tx.select({id:acceptedSources.id}).from(acceptedSources).where(eq(acceptedSources.id,request.acceptedSourceId)).limit(1)]);
  if(!revision)return {kind:"target-conflict" as const};
  const [currentRevision]=await tx.select({id:briefingRevisions.id}).from(briefingRevisions).where(eq(briefingRevisions.briefingId,revision.briefingId)).orderBy(desc(briefingRevisions.sequence)).limit(1);
  if(currentRevision?.id!==revision.id)return {kind:"target-conflict" as const};
  if(!accepted)return {kind:"source-conflict" as const}; const at=new Date(request.occurredAt);
  const [claim]=await tx.insert(claims).values({briefingRevisionId:revision.id,statement:request.candidate.statement,status:"candidate",createdBy:request.actorId,createdAt:at,updatedAt:at}).returning({id:claims.id});
  const [support]=await tx.insert(claimSupports).values({claimId:claim.id,acceptedSourceId:accepted.id,kind:"direct",excerpt:request.candidate.excerpt,rationale:request.candidate.rationale,addedBy:request.actorId,addedAt:at}).returning({id:claimSupports.id});
  const [decision]=await tx.insert(proposalDecisionRecords).values({idempotencyKey:request.idempotencyKey,sourceSubmissionId:request.submissionId,proposalOutputFingerprint:request.expectedOutputFingerprint,proposalPart:"candidate-claim",outcome:"accepted",actorId:request.actorId,occurredAt:at,briefingRevisionId:revision.id,acceptedSourceId:accepted.id,claimId:claim.id,claimSupportId:support.id,metadata:{candidateIndex:request.candidateIndex,statement:request.candidate.statement}}).returning({id:proposalDecisionRecords.id});
  return {kind:"created" as const,claimId:claim.id,claimSupportId:support.id,decisionId:decision.id};
 });}
}
function prepared(row:typeof sourceSubmissions.$inferSelect):PreparedCandidateClaims|undefined{if(row.preparationResultState!=="prepared"&&row.preparationResultState!=="needs-review")return undefined;const result=mapPersistedSourcePreparation(row);if(result.state!=="prepared"&&result.state!=="needs-review")return undefined;return {submissionId:row.id,state:result.state,outputFingerprint:fingerprintProposalOutput(result.proposal),candidateClaims:result.proposal.candidateClaims.map(x=>({statement:x.statement,excerpt:x.excerpt,confidence:x.confidence,rationale:x.rationale}))};}
