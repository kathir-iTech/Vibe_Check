---
doc: scope
status: approved
---

# VibeCheck — Build-Honesty Checker

One line: A tool that cross-checks AI coding agents' claims against real repo evidence and your own spec, returning TRUE / UNVERIFIED / SPEC-DRIFT verdicts per claim.

## The Unique Kernel
The killer feature is the "2am discovery prevention": catching agent overclaiming *before* the deadline, not after. No one else can produce the exact retroactive number from running it against their own 8 past build logs — that's uniquely VibeCheck's data. The claim extraction + evidence cross-reference loop is the core, not the UI.

## Who It's For
A first-year AI&DS student (or any solo builder) doing AI-assisted hackathons who has been burned by coding agents claiming "done/fixed/deployed/tested" when they weren't. They use AI agents as their primary coding partner and need someone (or something) to hold those agents accountable.

## The Core Loop
The builder pastes their agent's last message + a GitHub repo URL. The tool extracts each checkable claim, cross-references it against real repo evidence (commits, files, diffs) and against the repo's own scope.md/prd.md/spec.md, and returns a claim-by-claim verdict: TRUE / UNVERIFIED / SPEC-DRIFT, each with the exact commit/file/line.

## Inspiration & Identity
VibeCheck — the name signals the vibe-coding culture it targets. Alternates: Attestor, ReceiptLine (easy to swap before the repo goes public, but pick one now so the Devpost draft/repo slug doesn't drift later). The demo moment is the core identity: feed a deliberately false claim ("added auth, all tests pass") against a repo with no auth code → live on screen it returns UNVERIFIED/red, points at the missing file. Bonus: run it on its own repo at the very end — the tool auditing the build that built it.

## Why This Matters to the Learner
The learner has shipped 8 hackathon builds with zero wins. Every loss traces back to the same failure mode: the coding agent said "done" and it wasn't. They found out at 2am the night before the deadline. This tool would have caught it early enough to fix.

## What "Working" Looks Like
Paste a claim + repo URL → see claim-by-claim verdicts with evidence (commit hash, file path, line number). Demo moment works on screen: false claim returns UNVERIFIED/red with missing file pointed at. The tool runs on its own repo at the end, proving it works on itself.

## The POC Boundary
Five features only: (1) claim extractor — paste agent message → structured list of checkable claims; (2) repo evidence checker — claims cross-referenced against GitHub API (commits/files/diffs); (3) spec-drift detector — build reality vs. scope.md/prd.md/spec.md; (4) fallback demo mode — preloaded example repo behind `?demo=1` flag; (5) shareable verdict report — exportable/permalink.
Stack locked: React/Next.js + TypeScript + Tailwind, Gemini for claim extraction/reasoning, GitHub REST API for repo reads, Vercel hosting. Deliberately no sandboxed code execution — evidence checks are static/API-based only.

## Later
- Running against the learner's own 8 past hackathon build logs to produce the published number
- Support for more evidence sources (live URLs, pasted terminal output)
- Multi-repo cross-referencing

## Explicitly Cut
- Sandboxed code execution (no running code in the tool — this is a deliberate boundary, not a gap)
- Full CI/CD integration
- Team/collaboration features
- Language model training or fine-tuning
- Anything beyond the 5 features
