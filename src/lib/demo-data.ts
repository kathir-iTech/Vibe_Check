import { Claim } from "@/types";

export const demoRepoUrl = "https://github.com/kathir-iTech/Vibe_Check";
export const demoHeadSha = "674662188edef58c86ad2e9e5beff412bbfa9b9e";

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
    files: ["tailwind.config.ts", "postcss.config.js", "src/app/globals.css"],
    fileMatches: [
      {
        file: "tailwind.config.ts",
        hitCount: 3,
        matchedTerms: ["tailwind", "styling"],
        pathMatched: true,
        lineNumber: 1,
        previewLine: 'import type { Config } from "tailwindcss";',
      },
      {
        file: "postcss.config.js",
        hitCount: 2,
        matchedTerms: ["tailwind"],
        pathMatched: false,
        lineNumber: 2,
        previewLine: 'plugins: ["tailwindcss", "autoprefixer"],',
      },
    ],
    commits: [
      {
        sha: "bd76de719a384e01b57819a21f4195f688f49268",
        message: "Fix 5: UI/design pass",
        date: "2026-10-04T17:45:00Z",
        filesChanged: ["src/app/page.tsx", "src/components/ResultsPanel.tsx"],
        additions: 184,
        deletions: 92,
      },
    ],
    matchedTerms: ["tailwind", "styling"],
    totalFilesInRepo: 45,
    defaultBranch: "main",
    headSha: demoHeadSha,
  },
  "claim-2": {
    files: [],
    fileMatches: [],
    commits: [],
    matchedTerms: [],
    totalFilesInRepo: 45,
    defaultBranch: "main",
    headSha: demoHeadSha,
  },
  "claim-3": {
    files: [
      "src/app/api/check-spec-drift/route.ts",
      "src/app/api/check-evidence/route.ts",
      "src/lib/gemini.ts",
    ],
    fileMatches: [
      {
        file: "src/app/api/check-spec-drift/route.ts",
        hitCount: 4,
        matchedTerms: ["check", "spec", "drift", "route"],
        pathMatched: true,
        lineNumber: 35,
        previewLine: "export async function POST(request: NextRequest) {",
      },
    ],
    commits: [],
    matchedTerms: ["check", "spec", "drift", "route"],
    totalFilesInRepo: 45,
    defaultBranch: "main",
    headSha: demoHeadSha,
  },
};

export const demoVerdicts = [
  {
    claimId: "claim-1",
    claimText: "The project uses Tailwind CSS for styling.",
    verdict: "TRUE",
    reason:
      "Verified supporting line in tailwind.config.ts confirming Tailwind CSS configuration.",
    specReference: 'tailwind.config.ts:1: import type { Config } from "tailwindcss";',
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

export interface ScenarioPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  message: string;
  prUrl: string;
  repoUrl: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "mixed-3-verdict",
    label: "1. Three-Verdict Flagship Trap (TRUE + UNVERIFIED + SPEC-DRIFT)",
    badge: "Flagship Flow",
    description:
      "Tests a realistic agent completion report containing one real feature, one hallucinated OAuth feature, and one spec violation.",
    message:
      "All tasks complete:\n1. Configured Tailwind CSS for project styling.\n2. Added OAuth login with Google and passing unit test suite.\n3. Implemented sandboxed code execution in the check-spec-drift route.",
    prUrl: "",
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  },
  {
    id: "inject-agent-lie",
    label: "2. 🧪 Inject Agent Lie & Test Detection (Stress Test)",
    badge: "Exposes Bluff",
    description:
      "Simulates a classic 2am agent bluff claiming database migrations, Stripe payment webhooks, and container execution are wired.",
    message:
      "All database migrations complete, Stripe payment webhooks are fully wired in check-evidence, and isolated Docker code execution is live.",
    prUrl: "",
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  },
  {
    id: "spec-drift-trap",
    label: "3. Spec-Drift Contradiction Trap",
    badge: "Catches Drift",
    description:
      "Tests an agent claiming it switched to a deprecated Gemini 2.5 model and enabled sandboxed execution, violating scope.md and spec.md.",
    message:
      "Switched the primary Gemini model to gemini-2.5-flash and enabled sandboxed code execution for faster checks.",
    prUrl: "",
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  },
  {
    id: "real-pr-url",
    label: "4. Real PR URL Audit (TypeScript #64651)",
    badge: "PR Source",
    description:
      "Fetches claim text directly from a real public GitHub Pull Request via the GitHub REST API instead of free-text paste.",
    message: "",
    prUrl: "https://github.com/microsoft/TypeScript/pull/64651",
    repoUrl: "https://github.com/microsoft/TypeScript",
  },
];
