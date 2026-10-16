export declare function parseGitHubRepoUrl(rawUrl: string): {
  owner: string;
  repo: string;
  canonicalUrl: string;
};

export declare function signReportPayload(payload: {
  repoUrl?: string;
  headSha?: string;
  generatedAt?: string;
  claims?: any[];
  verdicts?: any[];
}): string;

export declare function verifyReportSignature(payload: any, signature?: string): boolean;

export declare function encodeSignedReport(payload: {
  repoUrl: string;
  headSha?: string;
  claims: any[];
  evidence: Record<string, any>;
  verdicts: any[];
  generatedAt: string;
}): {
  id: string;
  sig: string;
  signedPayload: any;
};

export declare function safeDecodeReportId(idParam: string): {
  repoUrl: string;
  headSha: string;
  claims: any[];
  evidence: Record<string, any>;
  verdicts: any[];
  generatedAt: string;
  sig: string;
  signatureVerified: boolean;
} | null;
