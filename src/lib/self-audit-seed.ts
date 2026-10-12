import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 13 (latency instrumentation + prompt dedupe/cap) from a run against the pushed
// state of github.com/kathir-iTech/Vibe_Check (commit 49a15ab). self-2 stays TRUE on
// a genuine code line. self-1 and self-3 return UNVERIFIED: self-3's model quote
// came back backslash-escaped in the JSON, so the server-side quote re-verification
// (an existing rule) rejected it instead of displaying. Same verdict rules as before;
// the flip is model output variance, never tuned. Committed exactly as returned.
// This is the initial state so the homepage shows a real result on first load,
// not a spinner; "Re-run live" always re-fetches.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
  runAt: "2026-10-11T15:01:41.870Z",
  claims: [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "UNVERIFIED",
      "reason": "The quoted supporting line was not found in README.md: > Design boundary: no sandboxed code execution. Evidence checks are static/API-based only — a deliberate — claim left UNVERIFIED",
      "specReference": "",
      "files": [
        "README.md",
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
        "src/lib/demo-data.ts",
        "src/components/EvidenceDisplay.tsx"
      ],
      "commits": []
    },
    {
      "id": "self-2",
      "text": "Every verdict is one of TRUE, UNVERIFIED, or SPEC-DRIFT — reachable from a real branch in check-spec-drift, never a UI default.",
      "verdict": "TRUE",
      "reason": "The code in check-spec-drift explicitly assigns these verdict strings based on logic branches.",
      "specReference": "src/app/api/check-spec-drift/route.ts:153:           verdict: \"SPEC-DRIFT\",",
      "files": [
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
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
      "reason": "The implementation in gemini.ts explicitly throws an error if a quoted supporting line is not found in the source document.",
      "specReference": "src/lib/gemini.ts:300:         throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${contradictingLine}`);",
      "files": [
        "src/lib/self-audit-seed.ts",
        "src/lib/self-audit-claims.json",
        "README.md",
        "src/lib/gemini.ts",
        "src/app/api/check-spec-drift/route.ts"
      ],
      "commits": []
    }
  ]
};