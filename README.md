# VibeCheck — Build-Honesty Checker

AI coding agents say "done", "fixed", "deployed", "all tests pass" — often before any of it is true.
VibeCheck cross-checks those claims against real repo evidence (commits, files, diffs) and the repo's own
planning docs, then returns a verdict per claim.

**Paste an agent message + a GitHub repo URL → get claim-by-claim verdicts with the exact commit, file, and line.**

## Verdicts

| Verdict | Meaning | Color |
| --- | --- | --- |
| `TRUE` | Evidence found in the repo (commit / file / line cited) | green |
| `UNVERIFIED` | No evidence found for the claim | red |
| `SPEC-DRIFT` | Claim contradicts the repo's own `scope.md` / `prd.md` / `spec.md` | amber |

## Known limitations

- **`SPEC-DRIFT` proves the quote exists, not that it contradicts the claim.** The quoted line is verified against
  the real file content server-side, but the judgment that a line contradicts the claim is the model's. A claim can
  therefore be marked `SPEC-DRIFT` against a line that is real and unrelated — e.g. a Slack-webhook claim cited
  against a line that only says the feature budget is hard-capped at 5.
- **Retrieval is bounded.** Evidence lookup scores claim keywords against file paths, then against the content of up
  to 60 text files (20KB each, 10s budget, top 5 per claim). A file outside that window is never fetched, so its
  content cannot be cited as support.

## Features

1. **Claim extractor** — turns an agent's free-text message into a structured list of checkable claims (Gemini).
2. **Repo evidence checker** — cross-references each claim against GitHub REST API data (commits, file paths, file contents).
3. **Spec-drift detector** — compares claims against the repo's own planning docs and cites the contradicting line.
4. **Demo mode** — preloaded example repo data at `/demo`, for when GitHub/Gemini hiccup or you just want the flow.
5. **Shareable verdict report** — permalink (`/report/[id]`) plus JSON export.

Plus a **Self-Audit** card: VibeCheck run against its own repo (`github.com/kathir-iTech/Vibe_Check`), with an
on-demand **Re-run live** button.

## Demo moment

Feed it a deliberately false claim — *"added auth, all tests pass"* — against a repo with no auth code.
It returns `UNVERIFIED` in red and points at the missing file.

## Tech stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS**
- **Gemini API** (`@google/genai`, `gemini-3-flash-preview`) for claim extraction and reasoning
- **GitHub REST API** for repo reads — static evidence checks only
- **Vercel** for hosting

> **Design boundary:** no sandboxed code execution. Evidence checks are static/API-based only — a deliberate
> choice, not a gap.

## Getting started

### Prerequisites

- Node.js 18.18+ (Node 20+ recommended)
- A [Gemini API key](https://aistudio.google.com/apikey)
- A [GitHub personal access token](https://github.com/settings/tokens) (public repos only need read access)

### Setup

```bash
git clone https://github.com/kathir-iTech/Vibe_Check.git
cd Vibe_Check
npm install
```

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your-gemini-api-key
GITHUB_TOKEN=your-github-token
```

Both keys are read **server-side** inside API routes, so they never reach the browser.

### Run

```bash
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint over src/
```

## How to use it

1. Paste the agent's last message into the message box.
2. Paste the GitHub repo URL it was working on.
3. Click **Check Claims** — extraction → evidence → spec-drift → verdicts appear claim by claim.
4. **Generate Shareable Report** for a permalink, or **Export Report (JSON)** for a file.

Other entry points:

- `/demo` — the full flow with preloaded data, no API keys or network needed
- Homepage **Self-Audit** card — VibeCheck's verdicts on its own repo, plus **Re-run live**
- `/report/[id]` — open a previously generated report from its permalink

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/extract-claims` | Gemini extracts checkable claims from the agent message |
| `POST /api/check-evidence` | GitHub REST API evidence lookup per claim |
| `POST /api/check-spec-drift` | Contradiction check against the repo's planning docs |
| `POST /api/generate-report` | Builds the shareable report permalink |
| `POST /api/self-audit` | Runs VibeCheck's own fixed claims against this repo |

## Project structure

```
src/
├── app/
│   ├── page.tsx              # Main check flow
│   ├── demo/page.tsx         # Demo mode (/demo)
│   ├── report/[id]/page.tsx  # Shareable report page
│   └── api/                  # Server-side Gemini + GitHub calls
├── components/               # ClaimInput, ResultsPanel, EvidenceDisplay, SelfAudit, ReportExport...
├── lib/                      # github.ts, gemini.ts, demo-data.ts, self-audit-seed.ts
└── types/                    # Claim, Verdict, Report types
devpost/                      # Scope, PRD, spec, build checklist
```

## Failure modes handled

- **GitHub rate limit** → message suggesting demo mode (`/demo`)
- **Gemini error** → one retry, then a friendly fallback message
- **Private / missing repo** → all claims `UNVERIFIED` with a "repo not accessible" note
- **No planning docs in the repo** → spec-drift skipped, verdicts fall back to `UNVERIFIED`

## Docs

Planning and build docs live in [`devpost/`](devpost/):

- [`scope.md`](devpost/scope.md) — the idea, the POC boundary, what was cut
- [`prd.md`](devpost/prd.md) — product definition and core journey
- [`spec.md`](devpost/spec.md) — technical blueprint, data model, failure modes
- [`checklist.md`](devpost/checklist.md) — build slices and verification

## License

[MIT](LICENSE)
