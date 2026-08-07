import type { SourceSubmissionKind } from "./source-preparation";

export type SourceSubmissionQueueItem = Readonly<{ id: string; kind: SourceSubmissionKind; originalIdentifier: string; submittedAt: string; processingStatus: string; attemptCount: number }>;
export type SourceSubmissionReview = Readonly<{
  id: string; kind: SourceSubmissionKind; originalIdentifier: string; submittedBy: string; submittedAt: string; rightsNote: string;
  processingStatus: string; resultState?: string; retrievedAt?: string;
  preparedOutputFingerprint?: string;
  proposal?: Readonly<{ proposedTopic: string; proposedSubtopic?: string; confidence: number; rationale: string; candidateClaims: ReadonlyArray<Readonly<{ statement: string; excerpt: string; confidence: number; rationale: string }>>; draft: Readonly<{ templateVersion: string; title: string; sections: ReadonlyArray<Readonly<{ section: string; body: string }>> }> }>;
}>;
export type SourceSubmissionReadRepository = Readonly<{ listSourceSubmissions(): Promise<ReadonlyArray<SourceSubmissionQueueItem>>; getSourceSubmission(id: string): Promise<SourceSubmissionReview | undefined> }>;
