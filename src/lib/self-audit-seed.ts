import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 10 (verified-support TRUE): all three claims now come back UNVERIFIED,
// because none of them has a supporting quote verified against a matched file.
// A genuine run against github.com/kathir-iTech/Vibe_Check, committed as the
// initial state so the homepage shows a real result on first load, not a spinner.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  "repoUrl": "https://github.com/kathir-iTech/Vibe_Check",
  "runAt": "2026-10-09T02:19:00.400Z",
  "claims": [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "UNVERIFIED",
      "reason": "Matches the design boundary explicitly stated in the Technical Spec.",
      "specReference": "",
      "files": [
        ".agents/skills/5-build/references/code-tour.md",
        "src/app/api/check-evidence/route.ts",
        "src/app/api/check-spec-drift/route.ts",
        "src/components/EvidenceDisplay.tsx"
      ],
      "commits": []
    },
    {
      "id": "self-2",
      "text": "Every verdict is one of TRUE, UNVERIFIED, or SPEC-DRIFT — reachable from a real branch in check-spec-drift, never a UI default.",
      "verdict": "UNVERIFIED",
      "reason": "Matches the verdict types defined in the Technical Spec.",
      "specReference": "",
      "files": [
        ".agents/skills/4-spec/SKILL.md",
        ".agents/skills/4-spec/references/spec-patterns.md",
        ".agents/skills/4-spec/templates/spec-template.md",
        ".agents/skills/5-build/templates/checklist-template.md",
        "devpost/checklist.md",
        "devpost/spec.md",
        "src/app/api/check-evidence/route.ts",
        "src/app/api/check-spec-drift/route.ts"
      ],
      "commits": []
    },
    {
      "id": "self-3",
      "text": "SPEC-DRIFT citations are verified against the real file content server-side before being shown — a quote that doesn't actually exist in the cited doc throws an error instead of displaying.",
      "verdict": "UNVERIFIED",
      "reason": "The planning documents include citation validation as a requirement in the build checklist.",
      "specReference": "",
      "files": [
        ".agents/skills/1-start/templates/learner-profile-template.md",
        ".agents/skills/4-spec/SKILL.md",
        ".agents/skills/4-spec/references/spec-patterns.md",
        ".agents/skills/4-spec/templates/spec-template.md",
        "devpost/spec.md",
        "src/app/api/check-spec-drift/route.ts"
      ],
      "commits": []
    }
  ]
};
