export interface Claim {
  id: string;
  text: string;
  evidenceType: string[];
  verdict?: "TRUE" | "UNVERIFIED" | "SPEC-DRIFT";
  evidence?: ClaimEvidence;
}

export interface ClaimEvidence {
  commits: string[];
  files: string[];
  lines: number[];
  specDrift?: boolean;
}

export type Verdict = "TRUE" | "UNVERIFIED" | "SPEC-DRIFT";

export interface Report {
  repoUrl: string;
  claims: Claim[];
  generatedAt: string;
  permalink?: string;
}
