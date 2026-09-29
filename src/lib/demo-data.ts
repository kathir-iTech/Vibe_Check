export const demoClaims = [
  { id: "claim-1", text: "I added authentication and all tests pass", evidenceType: ["file", "commit"], verdict: "UNVERIFIED" },
  { id: "claim-2", text: "I implemented the user profile page", evidenceType: ["file", "commit"], verdict: "UNVERIFIED" },
  { id: "claim-3", text: "I refactored the API client", evidenceType: ["file", "commit"], verdict: "TRUE" },
];

export const demoRepoUrl = "https://github.com/kathir-iTech/vibecheck";

export const demoVerdicts = [
  { claimId: "claim-1", verdict: "UNVERIFIED", evidence: "No auth-related files or commits found in the repo" },
  { claimId: "claim-2", verdict: "UNVERIFIED", evidence: "No user profile page files found in the repo" },
  { claimId: "claim-3", verdict: "TRUE", evidence: "Found in src/lib/api-client.ts, commit abc123" },
];
