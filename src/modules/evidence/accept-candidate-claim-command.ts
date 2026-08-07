export type CandidateClaim = Readonly<{ statement:string; excerpt:string; confidence:number; rationale:string }>;
export type PreparedCandidateClaims = Readonly<{ submissionId:string; state:"prepared"|"needs-review"; outputFingerprint:string; candidateClaims:ReadonlyArray<CandidateClaim> }>;
export type AcceptCandidateClaimRequest = Readonly<{idempotencyKey:string;submissionId:string;expectedOutputFingerprint:string;candidateIndex:number;briefingRevisionId:string;acceptedSourceId:string;actorId:string;occurredAt:string}>;
export type AcceptCandidateClaimRepository = Readonly<{
 retrievePreparedCandidateClaims(submissionId:string):Promise<PreparedCandidateClaims|undefined>;
 acceptCandidateClaim(request:AcceptCandidateClaimRequest & Readonly<{candidate:CandidateClaim}>):Promise<Readonly<{kind:"created"|"idempotent";claimId:string;claimSupportId:string;decisionId:string}>|Readonly<{kind:"proposal-conflict"|"target-conflict"|"source-conflict"|"idempotency-conflict"}>>;
}>;
export function createAcceptCandidateClaimCommand(repository:AcceptCandidateClaimRepository){return {async accept(request:AcceptCandidateClaimRequest){
 if(!request.actorId.trim()||!Number.isInteger(request.candidateIndex)||request.candidateIndex<0||!validDate(request.occurredAt)) return {ok:false as const,reason:"invalid-request" as const};
 const prepared=await repository.retrievePreparedCandidateClaims(request.submissionId);
 if(!prepared) return {ok:false as const,reason:"proposal-not-found" as const};
 if(prepared.outputFingerprint!==request.expectedOutputFingerprint) return {ok:false as const,reason:"proposal-conflict" as const};
 const candidate=prepared.candidateClaims[request.candidateIndex]; if(!candidate) return {ok:false as const,reason:"candidate-not-found" as const};
 const result=await repository.acceptCandidateClaim({...request,actorId:request.actorId.trim(),candidate});
 return result.kind==="created"||result.kind==="idempotent"?{ok:true as const,...result}:{ok:false as const,reason:result.kind};
}}}
function validDate(value:string){return !Number.isNaN(Date.parse(value));}
