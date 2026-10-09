import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 12 (injection hardening + restatement guard) from a run against the pushed
// state of github.com/kathir-iTech/Vibe_Check. self-1 flipped TRUE -> UNVERIFIED:
// its only support was the README line that restates the claim, and the
// restatement guard rejects that. self-2 and self-3 stay TRUE on genuine code
// lines. Committed exactly as returned — no claim or prompt tuning.
// This is the initial state so the homepage shows a real result on first load,
// not a spinner; "Re-run live" always re-fetches.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  "repoUrl": "https://github.com/kathir-iTech/Vibe_Check",
  "runAt": "2026-10-09T07:43:38.363Z",
  "claims": [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "UNVERIFIED",
      "reason": "The cited line restates the claim; a restatement is not evidence.",
      "specReference": "",
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
      "specReference": "src/app/api/check-spec-drift/route.ts:143:           verdict: \"SPEC-DRIFT\",",
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
      "specReference": "src/lib/gemini.ts:245:         throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${contradictingLine}`);",
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
