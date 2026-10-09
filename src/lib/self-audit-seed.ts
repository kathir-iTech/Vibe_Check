import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 11 (content-based retrieval) from a run against the pushed state of
// github.com/kathir-iTech/Vibe_Check: retrieval now scores file content as well
// as file paths, so all three claims reach TRUE on a supporting quote verified
// against a real line (README.md, check-spec-drift/route.ts, gemini.ts).
// Committed exactly as returned — no claim or prompt tuning.
// This is the initial state so the homepage shows a real result on first load,
// not a spinner; "Re-run live" always re-fetches.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  "repoUrl": "https://github.com/kathir-iTech/Vibe_Check",
  "runAt": "2026-10-09T03:27:04.111Z",
  "claims": [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "TRUE",
      "reason": "The claim is consistent with the project's stated design boundaries in the planning documents.",
      "specReference": "README.md:50: > **Design boundary:** no sandboxed code execution. Evidence checks are static/API-based only — a deliberate",
      "files": [
        "README.md",
        "src/lib/self-audit-seed.ts",
        "src/app/api/self-audit/route.ts",
        "src/lib/demo-data.ts",
        "src/components/EvidenceDisplay.tsx"
      ],
      "commits": []
    },
    {
      "id": "self-2",
      "text": "Every verdict is one of TRUE, UNVERIFIED, or SPEC-DRIFT — reachable from a real branch in check-spec-drift, never a UI default.",
      "verdict": "TRUE",
      "reason": "The claim matches the defined verdict types in the project documentation.",
      "specReference": "src/app/api/check-spec-drift/route.ts:141:           verdict: \"SPEC-DRIFT\",",
      "files": [
        "src/lib/self-audit-seed.ts",
        "src/app/api/self-audit/route.ts",
        "README.md",
        "src/app/api/check-spec-drift/route.ts",
        "src/app/page.tsx"
      ],
      "commits": [
        {
          "sha": "5a6ccf638137a7f1f92c4cbf990fc0037f9a1962",
          "message": "Fix 10: verified-support TRUE",
          "date": "2026-10-09T02:32:48Z"
        }
      ]
    },
    {
      "id": "self-3",
      "text": "SPEC-DRIFT citations are verified against the real file content server-side before being shown — a quote that doesn't actually exist in the cited doc throws an error instead of displaying.",
      "verdict": "TRUE",
      "reason": "The implementation in gemini.ts verifies quotes against file content and throws an error if the line number is not found.",
      "specReference": "src/lib/gemini.ts:194:         throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${contradictingLine}`);",
      "files": [
        "src/lib/self-audit-seed.ts",
        "src/app/api/self-audit/route.ts",
        "README.md",
        "src/app/api/check-spec-drift/route.ts",
        "src/lib/gemini.ts"
      ],
      "commits": []
    }
  ]
};
