import { SelfAuditResult } from "@/types";

// Captured from POST /api/self-audit against github.com/kathir-iTech/Vibe_Check.
// Initial state so the homepage renders verified self-audit data immediately with zero
// automatic API calls on page load; "Re-run live" triggers an on-demand check.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  runAt: "2026-10-16T13:15:00.000Z",
  claims: [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only \u2014 no sandboxed code execution.",
      "verdict": "TRUE",
      "reason": "README.md explicitly defines static/API-based evidence checks with no sandboxed code execution as the deliberate design boundary.",
      "specReference": "README.md:59: > **Design boundary:** no sandboxed code execution. Evidence checks are static/API-based only \u2014 a deliberate",
      "files": [
        "README.md",
        "src/lib/demo-data.ts",
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
        "src/components/EvidenceDisplay.tsx"
      ],
      "commits": [
        {
          "sha": "66343d00e18a9b71c49123f9a12b4981d723bc11",
          "message": "Add README",
          "date": "2026-10-07T18:10:12Z"
        }
      ]
    },
    {
      "id": "self-2",
      "text": "Every verdict is one of TRUE, UNVERIFIED, or SPEC-DRIFT \u2014 reachable from a real branch in check-spec-drift, never a UI default.",
      "verdict": "TRUE",
      "reason": "The code in check-spec-drift explicitly assigns SPEC-DRIFT, TRUE, and UNVERIFIED verdicts across dedicated conditional branches.",
      "specReference": "src/app/api/check-spec-drift/route.ts:171:           verdict: \"SPEC-DRIFT\",",
      "files": [
        "src/app/api/check-spec-drift/route.ts",
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
        "README.md",
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
      "text": "SPEC-DRIFT citations are verified against the real file content server-side before being shown \u2014 a quote that doesn't actually exist in the cited doc throws an error instead of displaying.",
      "verdict": "TRUE",
      "reason": "The implementation in src/lib/gemini.ts verifies contradictingLine via findLineNumber and throws an error when not found in sourceDoc.",
      "specReference": "src/lib/gemini.ts:304:         throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${contradictingLine}`);",
      "files": [
        "src/lib/gemini.ts",
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
        "README.md",
        "src/app/api/check-spec-drift/route.ts"
      ],
      "commits": [
        {
          "sha": "674662188edef58c86ad2e9e5beff412bbfa9b9e",
          "message": "Fix 18b: add test-core suite, app-map.html, and remove stray scratch files",
          "date": "2026-10-15T14:54:00Z"
        }
      ]
    }
  ]
};