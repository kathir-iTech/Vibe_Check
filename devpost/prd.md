---
doc: prd
status: approved
---

# VibeCheck — Product Requirements

A build-honesty checker for solo hackathon/vibe-coding builders. Paste your agent's latest claim + a GitHub repo URL → extract discrete checkable claims → cross-check each against real repo evidence (commits/files/diffs) and against the repo's own scope.md/prd.md/spec.md → return a claim-by-claim verdict: TRUE / UNVERIFIED / SPEC-DRIFT, each with its evidence.

## The Core Journey
1. The builder arrives at VibeCheck with their agent's last message and a GitHub repo URL
2. They paste the agent message and repo URL into the interface
3. VibeCheck extracts each checkable claim from the agent's message into a structured list
4. Each claim is cross-referenced against the GitHub repo (commits, files, diffs)
5. Each claim is checked against the repo's own scope.md/prd.md/spec.md files
6. The builder sees a claim-by-claim verdict: TRUE / UNVERIFIED / SPEC-DRIFT, each with exact commit/file/line evidence
7. The builder can generate a shareable/exportable verdict report

## Screens and Layout
Single-page app with:
1. **Input panel** — paste agent message, enter GitHub repo URL
2. **Results panel** — claim-by-claim verdict cards, each showing the claim text, verdict (color-coded: green TRUE, red UNVERIFIED, amber SPEC-DRIFT), and evidence (commit hash, file path, line number)
3. **Report section** — exportable/shareable verdict report, possibly a permalink
4. **Demo mode** — accessible via `?demo=1` flag with preloaded example repo data

## Look and Feel
Clean, direct, no-nonsense interface. The tool audits builds — it should feel like a strict but fair inspector. Red/green/amber verdicts are the primary visual language. Terminal-style evidence display (commit hashes, file paths, line numbers) reinforces the "show your work" ethos. Dark mode option for 2am builders.

## Features and Behavior

### Claim Extractor
**What the user can do:** Paste an agent's last message (free text) and have VibeCheck extract a structured list of checkable claims.
**What the user sees:** A list of claims, each with a brief description of what's being claimed and what evidence would be needed to verify it.
**Acceptance criteria:** Agent message → at least one structured claim. Claims should be discrete and verifiable (e.g., "added auth" → check for auth-related files/routes; "all tests pass" → check for test results). Powered by Gemini for claim extraction/reasoning.

### Repo Evidence Checker
**What the user can do:** Enter a GitHub repo URL and have VibeCheck cross-reference each extracted claim against real repo data.
**What the user sees:** For each claim, evidence of whether it's supported: commits that touch relevant files, file existence, diff content.
**Acceptance criteria:** GitHub REST API called for each repo. Real commit data, file listings, and diffs retrieved. Each claim mapped to specific evidence (commit hash, file path, line number). No sandboxed code execution — all evidence is static/API-based.

### Spec-Drift Detector
**What the user can do:** Have VibeCheck check if the build reality contradicts the repo's own scope.md/prd.md/spec.md.
**What the user sees:** For each claim, a SPEC-DRIFT flag if the claim contradicts the repo's own planning documents.
**Acceptance criteria:** VibeCheck reads scope.md/prd.md/spec.md from the target repo. Compares build claims against stated scope. Flags contradictions as SPEC-DRIFT.

### Fallback Demo Mode
**What the user can do:** Access a working demo via `?demo=1` flag with a preloaded example repo.
**What the user sees:** The full flow works with preloaded data, showing how the tool looks and feels even if GitHub/Gemini hiccups.
**Acceptance criteria:** `?demo=1` serves preloaded example repo data. Claim extraction, evidence checking, and spec-drift detection all work with demo data. No dead screens.

### Shareable Verdict Report
**What the user can do:** Export or share a permalink to their verdict results.
**What the user sees:** A shareable report with all claim verdicts and evidence.
**Acceptance criteria:** Report can be exported (PDF/markdown) or shared via a permalink. A judge or friend can open the result directly.

## States and Boundaries
- **Idle** — input panel visible, no claims extracted yet
- **Processing** — claims being extracted and verified
- **Results** — verdicts displayed with evidence
- **Demo mode** — preloaded data driving the flow
- **Error** — GitHub/Gemini hiccups handled gracefully, fallback to demo mode triggered

## Product Decisions
- Five features only — nothing else gets added. The feature budget is hard-capped at 5.
- No sandboxed code execution — evidence checks are static/API-based only. This is a deliberate boundary, not a gap.
- Gemini for claim extraction/reasoning, GitHub REST API for repo reads, Vercel for hosting.
- The tool should run on its own repo as a proof of concept (the tool auditing the build that built it).

## What We're Building
The full MVP with all 5 features: claim extractor, repo evidence checker, spec-drift detector, fallback demo mode, and shareable verdict report. Target: a working demo that can be shown to judges at a hackathon.

## Deferred From the POC
- Running against the learner's own 8 past hackathon build logs (reserved for the published number)
- Multi-repo cross-referencing
- Live URL parsing beyond GitHub
- CI/CD integration

## Possible Later Enhancements
- Support for more AI coding agents (Claude, Copilot, etc.)
- Historical tracking of agent claim accuracy over time
- Team-level accountability dashboards
- Integration with PR review systems

## Non-Goals
- Full sandboxed code execution (deliberate boundary)
- Building a full CI/CD pipeline
- Creating a marketplace or multi-tenant platform
- Mobile app (web-first)

## Open Questions
- How detailed should the Gemini claim extraction be? (likely: discrete, actionable claims)
- What format should the shareable report be in? (PDF, markdown, or web page)
- How to handle rate limits on GitHub API for large repos?
