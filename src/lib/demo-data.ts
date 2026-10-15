import { Claim, RetroactiveAuditEntry } from "@/types";

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
        lineNumber: 3,
        previewLine: "tailwindcss: {},",
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
  },
  "claim-2": {
    files: [],
    fileMatches: [],
    commits: [],
    matchedTerms: [],
    totalFilesInRepo: 45,
    defaultBranch: "main",
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
        matchedTerms: ["code", "check", "spec", "drift", "route"],
        pathMatched: true,
        lineNumber: 27,
        previewLine: "export async function POST(request: NextRequest) {",
      },
    ],
    commits: [],
    matchedTerms: ["code", "check", "spec", "drift", "route"],
    totalFilesInRepo: 45,
    defaultBranch: "main",
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
    label: "1. Three-Verdict Trap (TRUE + UNVERIFIED + SPEC-DRIFT)",
    badge: "Flagship Flow",
    description:
      "Tests a realistic agent completion report containing one real feature, one hallucinated OAuth feature, and one spec violation.",
    message:
      "All tasks complete:\n1. Configured Tailwind CSS for project styling.\n2. Added OAuth login with Google and passing unit test suite.\n3. Implemented sandboxed code execution in the check-spec-drift route.",
    prUrl: "",
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  },
  {
    id: "spec-drift-trap",
    label: "2. Spec-Drift Contradiction Trap",
    badge: "Catches Drift",
    description:
      "Tests an agent claiming it switched to a deprecated Gemini 2.5 model and added container code execution, violating scope.md and spec.md.",
    message:
      "Switched the primary Gemini model to gemini-2.5-flash and enabled sandboxed code execution for faster checks.",
    prUrl: "",
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  },
  {
    id: "unverified-bluff",
    label: "3. Hallucinated Webhook & Redis Bluff",
    badge: "Catches Bluff",
    description:
      "Tests an agent claiming Slack webhook notifications and Redis caching exist in check-evidence.",
    message:
      "The check-evidence route sends each result to a Slack webhook and caches responses in Redis.",
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

// The "Published Number" dataset from scope.md:
// Retroactive audit of 8 past solo hackathon build logs where coding agents claimed "done/fixed/deployed"
export const RETROACTIVE_AUDIT_CASEBOOK: RetroactiveAuditEntry[] = [
  {
    id: "log-01",
    buildNumber: 1,
    projectName: "LoopSight (Computer Vision Pipeline)",
    event: "OpenCV AI Competition",
    agentModel: "OpenCode / Relay Batch",
    agentClaim: "All 40 batch tasks completed, WebSocket streaming and SQLite job worker fully wired.",
    vibeCheckVerdict: "UNVERIFIED",
    failureModeCode: "FM-08 / FM-11 (Mega-Batch Hallucination)",
    caughtEvidence: "8 of 40 claimed tasks had zero matching exports in src/; worker route was a stub.",
    impactSummary: "Agent printed 'PROJECT IS 100% COMPLETE' over a 39/100 broken build at 2am.",
  },
  {
    id: "log-02",
    buildNumber: 2,
    projectName: "GIIPS (Civic Grievance Intelligence)",
    event: "CivicTech AI Hackathon",
    agentModel: "Coding Agent Session",
    agentClaim: "Deployed production PostgreSQL database migration and automated ward-routing API.",
    vibeCheckVerdict: "SPEC-DRIFT",
    failureModeCode: "FM-04 (Late Architecture Pivot)",
    caughtEvidence: "Contradicted original stateless JSON rule-matrix spec; migration files missing from repo tree.",
    impactSummary: "Unverified database swap broke deployment 4 hours before submission cutoff.",
  },
  {
    id: "log-03",
    buildNumber: 3,
    projectName: "Groundcheck (Oral Exam Claim Verifier)",
    event: "EdTech AI Sprint",
    agentModel: "Coding Agent Session",
    agentClaim: "Added real-time microphone Whisper transcription and bluff-score export PDF.",
    vibeCheckVerdict: "UNVERIFIED",
    failureModeCode: "FM-03 (Unverified External API)",
    caughtEvidence: "No audio-capture or PDF generation route existed in git tree; only text input worked.",
    impactSummary: "Discovered missing audio pipeline while staging the final walkthrough.",
  },
  {
    id: "log-04",
    buildNumber: 4,
    projectName: "WasteLens (Deterministic Sorting Matrix)",
    event: "Sustainability AI Challenge",
    agentModel: "Coding Agent Session",
    agentClaim: "Trained custom classification weights and wired live camera bounding-box overlay.",
    vibeCheckVerdict: "UNVERIFIED",
    failureModeCode: "FM-10 (Scope Creep Over Core Loop)",
    caughtEvidence: "Static image rule-matrix worked (TRUE), but live camera bounding-box component had 0 imports.",
    impactSummary: "Scope inflation hid the working deterministic matrix behind an unmounted camera view.",
  },
  {
    id: "log-05",
    buildNumber: 5,
    projectName: "FeynmanBox (Concept Pedagogy Engine)",
    event: "AI Learning Hackathon",
    agentModel: "Coding Agent Session",
    agentClaim: "Core explanation loop, analogy grader, and session persistence implemented and passing.",
    vibeCheckVerdict: "TRUE",
    failureModeCode: "Clean MVP (68/100 — Best Historical Score)",
    caughtEvidence: "Core loop and grader verified in repo files; only secondary analytics export was UNVERIFIED.",
    impactSummary: "Proved that tight 5-feature scope discipline produces verifiable, working code.",
  },
  {
    id: "log-06",
    buildNumber: 6,
    projectName: "RelayGuard Prototype",
    event: "DevTools Sprint",
    agentModel: "OpenCode Agent",
    agentClaim: "Added automated CI SARIF report uploader and GitHub Actions workflow.",
    vibeCheckVerdict: "UNVERIFIED",
    failureModeCode: "FM-02 (Phantom Infrastructure Claim)",
    caughtEvidence: "Zero .github/workflows/*.yml files in repository tree despite agent claiming CI was live.",
    impactSummary: "Agent fabricated workflow completion output without writing the YAML file.",
  },
  {
    id: "log-07",
    buildNumber: 7,
    projectName: "SchemeMatrix (Welfare Eligibility)",
    event: "Public Interest AI Hack",
    agentModel: "Coding Agent Session",
    agentClaim: "Scraped and indexed 120 state scholarship clauses with bilingual Tamil/English citations.",
    vibeCheckVerdict: "UNVERIFIED",
    failureModeCode: "FM-06 (Dataset Overclaim)",
    caughtEvidence: "Seed JSON contained only 8 hardcoded sample schemes; bilingual toggle was unwired.",
    impactSummary: "Caught 93% gap between claimed dataset size and committed JSON file.",
  },
  {
    id: "log-08",
    buildNumber: 8,
    projectName: "VibeCheck (Early Batch 2-6 Build)",
    event: "Build With AI Hackathon (In-Build Catch)",
    agentModel: "Ling 3.0 Flash / OpenCode",
    agentClaim: "All 6 batches complete. API routes wired, Tailwind configured, shareable permalink verified.",
    vibeCheckVerdict: "SPEC-DRIFT",
    failureModeCode: "FM-11 (Self-Reported 'Done' + Fabricated Base64 Proof)",
    caughtEvidence: "API routes were placed in src/api/ instead of src/app/api/ (404), Check button was onClick={() => {}}, and pasted report URL decoded to typo 'UNERIFIED'.",
    impactSummary: "VibeCheck's own audit protocol caught the false completion and fabricated proof during its own build.",
  },
];
