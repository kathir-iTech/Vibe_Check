export interface Claim {
  id: string;
  text: string;
  evidenceType: string[];
  verdict?: "TRUE" | "UNVERIFIED" | "SPEC-DRIFT";
  evidence?: ClaimEvidence;
}

export interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  author?: string;
  filesChanged?: string[];
  additions?: number;
  deletions?: number;
  patchPreview?: string;
}

export interface FileMatchDetail {
  file: string;
  hitCount: number;
  matchedTerms: string[];
  pathMatched?: boolean;
  lineNumber?: number;
  previewLine?: string;
}

export interface ClaimEvidence {
  commits: (string | CommitDetail)[];
  files: string[];
  lines?: number[];
  fileMatches?: FileMatchDetail[];
  matchedTerms?: string[];
  totalFilesInRepo?: number;
  defaultBranch?: string;
  specDrift?: boolean;
}

export type Verdict = "TRUE" | "UNVERIFIED" | "SPEC-DRIFT";

export interface Report {
  repoUrl: string;
  claims: Claim[];
  generatedAt: string;
  permalink?: string;
}

export interface SelfAuditClaim {
  id: string;
  text: string;
  verdict: Verdict;
  reason: string;
  specReference: string;
  files: string[];
  commits: { sha: string; message: string; date: string }[];
}

export interface SelfAuditResult {
  repoUrl: string;
  runAt: string;
  claims: SelfAuditClaim[];
}

export interface RetroactiveAuditEntry {
  id: string;
  buildNumber: number;
  projectName: string;
  event: string;
  agentModel: string;
  agentClaim: string;
  vibeCheckVerdict: Verdict;
  failureModeCode: string;
  caughtEvidence: string;
  impactSummary: string;
}
