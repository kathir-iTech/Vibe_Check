---
doc: spec
status: approved
---

# VibeCheck — Technical Spec

## Approved implementation revision — 18 October 2026

Verifier v2 preserves the static/API-only boundary and adds `/api/audit` for server-orchestrated, progress-streamed source resolution, claim extraction, evidence retrieval, assessment and complete report issuance. Existing lower-level routes remain available for bounded inspection. All reads use one resolved Git SHA. Imported PRs use their source repository/head revision; explicit base comparisons require an ancestor revision.

The current report schema is `vibecheck/audit/v2`: repository/head/base, atomic claims, evidence, verdicts, requirement review rows, document hashes, retrieval coverage, model usage, timings, provenance and warnings. Verdicts are TRUE, PARTIAL, UNVERIFIED or SPEC-DRIFT. Runtime obligations cannot be certified from source alone. A planning-conflict result needs implementation support and a cited conflicting planning line. Quote matching preserves source case and literal whitespace. Bounded lexical requirement associations do not establish semantic fulfillment.

Reports use complete Ed25519 signatures derived from a dedicated `REPORT_SIGNING_SECRET`; provider credentials and public fallback secrets are not used. `/api/report-key` publishes only the verification key. `/api/generate-report` accepts only an intact server audit receipt. New links store the report in the URL fragment at `/report/view`; it is not sent as a long server path. The browser verifies against this service's public key before rendering shared signed results. The standard-library Node verifier requires a separately trusted key. Historical partial HMAC signatures are not promoted to complete-report provenance.

The workspace stores optional working state only in the current browser tab. GitHub tokens remain in component memory, are sent only to the application's routes for GitHub reads, and are excluded from storage and exports. Public service credentials cannot expose a private repository; the visitor must supply their own authorized token. Tests include actual production route handlers with controlled provider responses and separate disclosed live-provider observations. Historical benchmark and self-audit records remain separate from current evaluation.

## How This Works, In Plain Language

VibeCheck takes an AI agent's claim message and a GitHub repo URL, extracts discrete checkable claims using Gemini, then cross-checks each claim against real GitHub repo data (commits, files, diffs) and the repo's own planning documents. It returns a verdict per claim: TRUE (evidence found), UNVERIFIED (no evidence), or SPEC-DRIFT (contradicts the repo's own spec). No code is executed — all evidence checks are static/API-based. This is a deliberate design boundary.

Why Next.js? The learner chose React/Next.js + TypeScript + Tailwind for the frontend, and Next.js provides a clean API route system for calling the GitHub API and Gemini API server-side. This keeps API keys out of the client. Vercel hosting is a natural fit for a Next.js app.

## The Core Journey Through the System

The builder pastes an agent message and repo URL → the frontend sends this to a Next.js API route → Gemini extracts claims → for each claim, the API calls GitHub REST API to gather evidence → claims are compared against the repo's scope.md/prd.md/spec.md → verdicts are returned → the frontend displays them with evidence → the builder can export or share the report.
PRD ref: `prd.md > The Core Journey`.

## Stack

- **Language:** TypeScript
- **Framework:** Next.js (React) for frontend + API routes
- **Styling:** Tailwind CSS
- **AI/Reasoning:** Gemini API for claim extraction and reasoning
- **Repo Data:** GitHub REST API for commits, files, diffs
- **Hosting:** Vercel
- **No sandboxed code execution** — evidence checks are static/API-based only

Rationale for each choice:

- Next.js: Provides API routes for server-side calls to GitHub and Gemini, keeping keys secure. Also the standard choice for Vercel deployment.
- TypeScript: Type safety for the structured claim/extraction data flow.
- Tailwind: Fast, utility-first styling for a clean tool interface.
- Gemini: Chosen for claim extraction and reasoning — the agent's natural language needs to be parsed into discrete, verifiable claims.
- GitHub REST API: The only source of truth for repo evidence — commits, files, diffs. Static reads only, no code execution.
- Vercel: Natural hosting for Next.js. Simple deployment for hackathon submissions.

## Where It Runs and How Someone Tries It

Runs in the browser as a Next.js web app. The GitHub API calls and Gemini calls happen server-side via Next.js API routes (so API keys stay secret). The builder opens the URL, pastes their agent message + repo URL, and clicks submit. Results appear claim-by-claim with evidence.

To try the demo: navigate to `?demo=1` to see the full flow with preloaded example repo data — useful when GitHub/Gemini hiccups or the builder wants to see it without a real repo.

Submission requires both a short demo video and a public GitHub repository. Deployment on Vercel is optional but recommended for the hackathon demo.

## Look and Feel

Owner-directed revision, 18 October 2026: midnight indigo surfaces, lilac source-support accents and a warm orange primary action. Self-hosted Space Grotesk headings and DM Sans body text give VibeCheck a distinct identity. Light mode remains available. The first screen has a short explanation, the agent message, repository URL and one primary action. Requirements, revision settings, sample messages and evaluation caveats expand on demand. Results use plain-language labels, with exact citations and technical provenance available for inspection. Mobile inputs retain a readable 16px size.

## Components

### ClaimExtractor

Extracts discrete checkable claims from an agent's free-text message using Gemini.
PRD ref: `prd.md > Claim Extractor`.
Input: raw agent message text. Output: structured list of claims, each with a claim description and suggested evidence type.

### RepoEvidenceChecker

Cross-references each claim against GitHub REST API data — commits, files, diffs.
PRD ref: `prd.md > Repo Evidence Checker`.
Input: repo URL + list of claims. Output: for each claim, evidence data (commit hash, file path, line number) or null if no evidence found.

### SpecDriftDetector

Compares build claims against the repo's own scope.md/prd.md/spec.md files pulled from GitHub.
PRD ref: `prd.md > Spec-Drift Detector`.
Input: repo URL + list of claims + repo's planning docs. Output: SPEC-DRIFT flag for any claim contradicting the repo's own specs.

### DemoMode

Serves preloaded example repo data when `?demo=1` is in the URL.
PRD ref: `prd.md > Fallback Demo Mode`.
Input: URL parameter `?demo=1`. Output: full flow with hardcoded example data.

### ReportExporter

Generates shareable/exportable verdict reports.
PRD ref: `prd.md > Shareable Verdict Report`.
Input: verdict results. Output: exportable file (PDF/markdown) or permalink URL.

## Data Model

- **Claim:** `{ id: string, text: string, evidenceType: string[], verdict?: Verdict, evidence?: ClaimEvidence }`
- **ClaimEvidence:** `{ commits: string[], files: string[], lines: number[], specDrift?: boolean }`
- **Verdict:** `"TRUE" | "UNVERIFIED" | "SPEC-DRIFT"`
- **Report:** `{ repoUrl: string, claims: Claim[], generatedAt: string, permalink?: string }`

## File Structure

```
project/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Main input page
│   │   ├── demo/page.tsx       # Demo mode page (?demo=1)
│   │   └── report/[id]/page.tsx # Shareable report page
│   ├── api/
│   │   ├── extract-claims/route.ts    # Gemini claim extraction
│   │   ├── check-evidence/route.ts    # GitHub API evidence checker
│   │   ├── check-spec-drift/route.ts  # Spec-drift detector
│   │   └── generate-report/route.ts   # Report exporter
│   ├── components/
│   │   ├── ClaimInput.tsx
│   │   ├── VerdictCard.tsx
│   │   ├── EvidenceDisplay.tsx
│   │   └── ReportExport.tsx
│   ├── lib/
│   │   ├── github.ts            # GitHub API client
│   │   ├── gemini.ts            # Gemini API client
│   │   └── demo-data.ts         # Preloaded demo data
│   └── types/
│       └── index.ts             # TypeScript types for Claim, Verdict, etc.
├── devpost/                    # Devpost learning workspace
├── public/
│   └── demo/                   # Demo assets
├── .env.local                  # API keys (GitHub token, Gemini key)
├── .gitignore
└── package.json
```

## External Services and Dependencies

- **Gemini API** — the configured primary defaults to `gemini-3-flash-preview`, with one bounded fallback attempt to `gemini-3.1-flash-lite` for recognized transient provider errors. The installed `@google/genai` SDK calls the provider server-side. Actual answering models, usage and failures are reported. Availability is not inferred from configuration.
- **GitHub REST API** — source reads, commit comparison and attributed check-run observations. Public reads can use the service credential; private reads require the visitor's own authority. Rate limits and permission failures remain explicit.
- **Vercel** — existing `vibe-check` project and `vibe-check-dev.vercel.app` domain. This continuation adds no paid resource or provider upgrade.

## Important Failure Modes

- **GitHub API rate limit exceeded** → Fail the request explicitly and preserve input and any earlier assessment. The visitor can choose the separately labeled example.
- **Gemini API error** → One bounded fallback attempt for recognized transient errors, then an explicit failure. Never silently substitute example data for a live request. Provider deadline/capacity errors have concise workspace messages.
- **Repo not found / private repo** → Fail access explicitly. Require the visitor's own authorized token for private source; do not invent claim assessments for an inaccessible repository.
- **Gemini misinterprets agent message** → Allow the builder to manually correct/edit extracted claims before verification begins.
- **Spec files missing from repo** → Skip the contradiction (spec-drift) check, but still allow TRUE from a supporting quote verified against real fetched file text; any claim without a verified supporting quote stays UNVERIFIED. Changed in Fix 10 — this line previously forced UNVERIFIED for every claim when spec files were missing.

## What Was Simplified and Why

- No sandboxed code execution — evidence checks are static/API-based only. This keeps the POC small, secure, and deployable on Vercel's free tier. The full version would run agent code in isolated containers, but that's out of scope for a hackathon POC.
- Single repo at a time (no multi-repo cross-referencing yet). Keeps the API call complexity manageable.
- Spec-drift detection only checks for direct contradictions (claim says "auth exists" but no auth file), not nuanced semantic drift.
- Demo data is hardcoded rather than dynamically generated. Simple and reliable.

## Decisions and Open Questions

- **Gemini chosen over OpenAI for claim extraction** — The learner's locked spec says Gemini. This is a learner choice; Gemini's reasoning capabilities are well-suited for parsing natural language into structured claims.
- **No sandboxed code execution is a deliberate boundary** — This is stated explicitly so it reads as a design choice, not a gap. In the write-up, say: "No sandboxed code execution — evidence checks are static/API-based only."
- **Open question: GitHub token handling** — Should the builder provide their own GitHub token, or should VibeCheck use a project-level token? A project-level token is simpler for the demo but less scalable. Decided: for POC, use a project-level token stored in `.env.local`.
- **Open question: Report format** — PDF export vs. markdown file vs. web permalink. The locked spec says "exportable/permalink." Likely: web permalink as the primary share mechanism, with an option to download as markdown.
- **Open question: What constitutes SPEC-DRIFT?** — Direct file contradiction (e.g., claim says "auth module added" but no auth file exists in the repo) is clear-cut. Semantic drift (e.g., claim says "tests improved" but spec says "tests are out of scope") needs more nuanced handling. For POC, focus on direct contradictions only.
