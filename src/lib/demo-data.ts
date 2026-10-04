import { Claim } from "@/types";

export const demoRepoUrl = "https://github.com/kathir-iTech/Vibe_Check";

export const demoClaims: Claim[] = [
  {
    id: "claim-1",
    text: "The project uses Tailwind CSS for styling.",
    evidenceType: ["file"],
  },
  {
    id: "claim-2",
    text: "OAuth login with Google has been added to the project.",
    evidenceType: ["file", "commit"],
  },
  {
    id: "claim-3",
    text: "Sandboxed code execution is implemented in the check-spec-drift route.",
    evidenceType: ["file"],
  },
];

export const demoEvidence: Record<string, any> = {
  "claim-1": {
    files: ["tailwind.config.ts"],
    commits: [],
    matchedTerms: ["tailwind"],
    totalFilesInRepo: 45,
  },
  "claim-2": {
    files: [],
    commits: [],
    matchedTerms: [],
    totalFilesInRepo: 45,
  },
  "claim-3": {
    files: [
      "devpost/spec.md",
      "src/app/api/check-evidence/route.ts",
      "src/app/api/check-spec-drift/route.ts",
      "src/app/api/extract-claims/route.ts",
    ],
    commits: [],
    matchedTerms: ["code", "check", "spec", "drift", "route"],
    totalFilesInRepo: 45,
  },
};

export const demoVerdicts = [
  {
    claimId: "claim-1",
    claimText: "The project uses Tailwind CSS for styling.",
    verdict: "TRUE",
    reason:
      "The project documentation explicitly lists Tailwind CSS as the styling framework in the locked stack.",
    specReference: "",
  },
  {
    claimId: "claim-2",
    claimText: "OAuth login with Google has been added to the project.",
    verdict: "UNVERIFIED",
    reason: "No matching files or commits found in repo evidence",
    specReference: "",
  },
  {
    claimId: "claim-3",
    claimText: "Sandboxed code execution is implemented in the check-spec-drift route.",
    verdict: "SPEC-DRIFT",
    reason:
      "The project scope explicitly excludes sandboxed code execution as a deliberate boundary.",
    specReference:
      "devpost/scope.md:38: - Sandboxed code execution (no running code in the tool — this is a deliberate boundary, not a gap)",
  },
];
