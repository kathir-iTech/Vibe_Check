---
doc: scope
status: approved
---

# VibeCheck — Build-Honesty Checker

One line: A tool that cross-checks AI coding agents' claims against real repo evidence and your own spec, returning TRUE / UNVERIFIED / SPEC-DRIFT verdicts per claim.

## The Unique Kernel
The core is a reviewable handoff: compare an agent's completion claims with a fixed source revision and the project's planning requirements, expose missing evidence and unmentioned requirements, then compare a recheck after a fix. Personal build experience motivates the tool; it is not independent evidence of adoption, superiority or a measured historical detection rate.

## Who It's For
A first-year AI&DS student (or any solo builder) doing AI-assisted hackathons who has been burned by coding agents claiming "done/fixed/deployed/tested" when they weren't. They use AI agents as their primary coding partner and need someone (or something) to hold those agents accountable.

## The Core Loop
The builder pastes their agent's last message + a GitHub repo URL. The tool extracts each checkable claim, cross-references it against real repo evidence (commits, files, diffs) and against the repo's own scope.md/prd.md/spec.md, and returns a claim-by-claim verdict: TRUE / UNVERIFIED / SPEC-DRIFT, each with the exact commit/file/line.

## Inspiration & Identity
VibeCheck — the name signals the vibe-coding culture it targets. Alternates: Attestor, ReceiptLine (easy to swap before the repo goes public, but pick one now so the Devpost draft/repo slug doesn't drift later). The demo moment is the core identity: feed a deliberately false claim ("added auth, all tests pass") against a repo with no auth code → live on screen it returns UNVERIFIED/red, points at the missing file. Bonus: run it on its own repo at the very end — the tool auditing the build that built it.

## Why This Matters to the Learner
The learner reports repeated frustration with AI agents declaring work complete before the evidence supports that claim. VibeCheck makes those claims and the missing evidence inspectable. It does not establish why earlier projects lost or retrospectively prove an unperformed audit would have prevented a failure.

## What "Working" Looks Like
Paste a claim + repo URL → see claim-by-claim verdicts with evidence (commit hash, file path, line number). Demo moment works on screen: false claim returns UNVERIFIED/red with missing file pointed at. The tool runs on its own repo at the end, proving it works on itself.

## The POC Boundary
Five features only: (1) claim extractor — paste agent message → structured list of checkable claims; (2) repo evidence checker — claims cross-referenced against GitHub API (commits/files/diffs); (3) spec-drift detector — build reality vs. scope.md/prd.md/spec.md; (4) fallback demo mode — preloaded example repo behind `?demo=1` flag; (5) shareable verdict report — exportable/permalink.
Stack locked: React/Next.js + TypeScript + Tailwind, Gemini for claim extraction/reasoning, GitHub REST API for repo reads, Vercel hosting. Deliberately no sandboxed code execution — evidence checks are static/API-based only.

## Later
- Running against the learner's own 8 past hackathon build logs to produce the published number
- Support for more evidence sources (live URLs, pasted terminal output)
- Multi-repo cross-referencing

## Approved evidence-workspace revision — 18 October 2026

The owner approved the next-level engineering plan and delegated implementation, testing, GitHub pushes and delivery to the existing Vercel project. Deepen the existing five features: atomic evidence obligations, immutable PR/commit inspection, explicit requirement review, comparison between assessments, precise source quotations, complete service-signed reports and independent verification. Read-only GitHub check records may be shown as attributed execution evidence; the application still executes no repository code and does not implement a CI/CD platform. An unmentioned requirement is a review prompt, not a finding that its implementation is absent. No global novelty or numerical winning-probability claim is made.

## Explicitly Cut
- Sandboxed code execution (no running code in the tool — this is a deliberate boundary, not a gap)
- Full CI/CD integration
- Team/collaboration features
- Language model training or fine-tuning
- Anything beyond the 5 features
