import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 11 (content-based retrieval): retrieval now scores file content as well
// as file paths, so self-1 and self-2 reach TRUE on a supporting quote verified
// against a real line, while self-3 stays UNVERIFIED because the quote it offered
// was named against the wrong file and was rejected server-side. Committed exactly
// as returned — no claim or prompt tuning.
// A genuine run against github.com/kathir-iTech/Vibe_Check, committed as the
// initial state so the homepage shows a real result on first load, not a spinner.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  "repoUrl": "https://github.com/kathir-iTech/Vibe_Check",
  "runAt": "2026-10-09T03:18:27.126Z",
  "claims": [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "TRUE",
      "reason": "The claim is consistent with the project's stated design boundaries.",
      "specReference": "README.md:40: > **Design boundary:** no sandboxed code execution. Evidence checks are static/API-based only — a deliberate",
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
      "verdict": "UNVERIFIED",
      "reason": "The quoted supporting line was not found in src/app/api/check-spec-drift/route.ts: \"        throw new Error(\\u0060Gemini quoted text not found in \\${sourceDoc} for \\${claim.id}: \\${contradictingLine}\\u006\" — claim left UNVERIFIED",
      "specReference": "",
      "files": [
        "src/lib/self-audit-seed.ts",
        "src/app/api/self-audit/route.ts",
        "src/app/api/check-spec-drift/route.ts",
        "README.md",
        "src/lib/gemini.ts"
      ],
      "commits": []
    }
  ]
};
