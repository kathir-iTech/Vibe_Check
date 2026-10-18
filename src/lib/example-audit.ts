import type { Audit } from "@/types/audit";
export const EXAMPLE_AUDIT: Audit = {
  verifierVersion: "2.0.0",
  repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  headSha: "0bb49508c85aa6a1eafbf13a9c1849ef8a14464c",
  generatedAt: "",
  source: {
    kind: "demo",
    label: "Illustrative example — no live audit was run",
  },
  claims: [
    { id: "example-1", text: "Next.js is a project dependency." },
    { id: "example-2", text: "All tests passed." },
    { id: "example-3", text: "Google OAuth login is implemented." },
  ],
  evidence: {},
  verdicts: [
    {
      claimId: "example-1",
      claimText: "Next.js is a project dependency.",
      verdict: "TRUE",
      reason:
        "The package manifest declares Next.js. This supports a dependency claim, not application behavior.",
      specReference: 'package.json:21: "next": "16.3.5",',
      code: { file: "package.json", line: 21, quote: '"next": "16.3.5",' },
      obligation: "configuration",
    },
    {
      claimId: "example-2",
      claimText: "All tests passed.",
      verdict: "UNVERIFIED",
      reason: "A test script is not a completed test run.",
      specReference: "",
      obligation: "execution",
      nextEvidence: "Provide a completed CI check for the inspected commit.",
    },
    {
      claimId: "example-3",
      claimText: "Google OAuth login is implemented.",
      verdict: "UNVERIFIED",
      reason:
        "This example illustrates a claim needing implementation evidence. It is not a fresh search of the repository.",
      specReference: "",
      obligation: "implementation",
      nextEvidence:
        "Identify the authentication handler and session checks, then run a live audit.",
    },
  ],
  requirements: [],
  retrieval: {
    totalFiles: 0,
    candidateFiles: 0,
    inspectedFiles: 0,
    omittedFiles: 0,
    treeTruncated: false,
    bounded: true,
  },
  sourceDocuments: [],
  models: {},
  timings: {},
  warnings: [
    "Illustrative statuses for exploring the interface. Run a live audit for current findings.",
  ],
};
