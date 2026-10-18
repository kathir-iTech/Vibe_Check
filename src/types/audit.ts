export interface AuditClaim {
  id: string;
  text: string;
  evidenceType?: string[];
}
export type AuditVerdict = "TRUE" | "PARTIAL" | "UNVERIFIED" | "SPEC-DRIFT";
export interface Citation {
  file: string;
  line: number;
  quote: string;
  context?: string;
}
export interface Finding {
  claimId: string;
  claimText: string;
  verdict: AuditVerdict;
  reason: string;
  specReference: string;
  supportingReference?: string;
  obligation?: string;
  nextEvidence?: string;
  code?: Citation;
  spec?: Citation;
  changeEvidence?: string;
  sourceCheck?: { ceiling: string; kind: string; note: string };
  contract?: {
    checked: string;
    established: string;
    unknown: string;
    resolve: string;
  };
}
export interface Requirement {
  id: string;
  text: string;
  file: string;
  line: number;
  quote: string;
  section: string;
  status: string;
  claimIds: string[];
  note?: string;
  strength?: string;
  suggestedClaimIds?: string[];
}
export interface Audit {
  schema?: string;
  verifierVersion: string;
  repoUrl: string;
  headSha: string;
  baseSha?: string;
  reviewContext?: string;
  generatedAt: string;
  claims: AuditClaim[];
  evidence: Record<string, any>;
  verdicts: Finding[];
  requirements: Requirement[];
  source: { kind: "live" | "demo" | "imported"; label: string };
  retrieval: {
    totalFiles: number;
    candidateFiles: number;
    inspectedFiles: number;
    omittedFiles: number;
    treeTruncated: boolean;
    bounded: boolean;
    followupCandidates?: number;
    fileHints?: string[];
  };
  sourceDocuments: { file: string; sha256: string; truncated: boolean }[];
  models: Record<string, any>;
  timings: Record<string, number>;
  warnings: string[];
  executionRecords?: {
    name: string;
    status: string;
    conclusion: string;
    url: string;
    headSha?: string;
    completedAt?: string;
    claimIds?: string[];
    note?: string;
  }[];
  sig?: string;
  keyId?: string;
}
