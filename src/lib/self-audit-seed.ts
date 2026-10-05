import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6).
// A genuine run against github.com/kathir-iTech/Vibe_Check, committed as the
// initial state so the homepage shows a real result on first load, not a spinner.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  "repoUrl": "https://github.com/kathir-iTech/Vibe_Check",
  "runAt": "2026-10-05T12:56:19.796Z",
  "claims": [
    {
      "id": "self-1",
      "text": "Evidence checks are static/API-based only — no sandboxed code execution.",
      "verdict": "TRUE",
      "reason": "Multiple documents explicitly state that evidence checks are static/API-based and that sandboxed code execution is deliberately excluded.",
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
      "verdict": "TRUE",
      "reason": "The documents consistently define TRUE, UNVERIFIED, and SPEC-DRIFT as the three verdict types and specify a dedicated API route for spec-drift detection.",
      "specReference": "",
      "files": [
        ".agents/skills/4-spec/SKILL.md",
        ".agents/skills/4-spec/references/spec-patterns.md",
        ".agents/skills/4-spec/templates/spec-template.md",
        ".agents/skills/5-build/templates/checklist-template.md",
        "devpost/spec.md",
        "src/app/api/check-evidence/route.ts",
        "src/app/api/check-spec-drift/route.ts"
      ],
      "commits": []
    },
    {
      "id": "self-3",
      "text": "SPEC-DRIFT citations are verified against the real file content server-side before being shown — a quote that doesn't actually exist in the cited doc throws an error instead of displaying.",
      "verdict": "TRUE",
      "reason": "The documents confirm that the tool reads the repo's planning documents server-side to detect contradictions, and nothing in the text precludes verifying citations against file content.",
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
