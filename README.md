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
- **`TRUE` means at least one verified supporting line, not that every clause was verified.** A compound claim can be
  marked `TRUE` on a single line that backs only part of it — read the cited line and check the rest yourself.
- **Documentation can support a design-boundary claim but cannot prove runtime behavior.** A README, PRD, or spec line
  states what the author intended; it is not evidence that the code does it at run time.
- **Injection mitigations are best-effort.** Untrusted text is delimited with a per-request nonce and labelled as data,
  quotes must exist verbatim in a fetched file, and lines that merely restate a claim are rejected — but a determined
  prompt injection can still steer which *real* line gets cited. No mitigation here is a guarantee.
- **SPEC-DRIFT keyword guard.** A contradicting line must share >=2 non-stopword keywords with the claim (using the same
  tokenizer as the restatement guard); otherwise it is treated as no contradiction. Reason: "The cited spec line does not
  mention the claim's subject; not treated as a contradiction."
## Features

1. **Claim extractor** — turns an agent's free-text message into a structured list of checkable claims (Gemini).
2. **Repo evidence checker** — cross-references each claim against GitHub REST API data (commits, file paths, file contents).
3. **Spec-drift detector** — compares claims against the repo's own planning docs and cites the contradicting line.
4. **Demo mode** — preloaded example repo data at `/?demo=1` and `/demo`, for when GitHub/Gemini hiccup or you just want the flow.
5. **Shareable verdict report** — HMAC-SHA256 signed permalink (`/report/[id]`) plus Markdown and JSON export.

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

## QA Benchmark (24 Claims × 3 Repeats = 72 Claim Outcomes across 6 Batch Runs)

VibeCheck includes a 24-claim labeled QA benchmark (`benchmark/claims.json` & `benchmark/results.json`) covering 12 true claims, 6 near-miss falsehoods, 4 absent-technology controls, and 2 unverifiable claims evaluated on `gemini-3.1-flash-lite`:

| Benchmark Metric | Result | Meaning |
| --- | --- | --- |
| **False Claims → `TRUE`** | `0 / 30` (0%) | Zero hallucinated or near-miss false claims passed as `TRUE` |
| **Unverifiable Claims → `TRUE`** | `0 / 6` (0%) | Zero unverifiable claims (unit tests, WCAG contrast) passed as `TRUE` |
| **True Claims → `SPEC-DRIFT`** | `0 / 36` (0%) | Zero false accusations on true claims (enforced by the `>=2` keyword guard) |
| **True Claims → `TRUE`** | `32 / 36` (88.9%) | Verified recall with exact `file:line` quote verification |
| **Run Variance** | `3 / 24` | Claims whose verdict varied across the 3 batch repeats |

## Getting started

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- A [Gemini API key](https://aistudio.google.com/apikey)
- A [GitHub personal access token](https://github.com/settings/tokens) (optional for public repos; raises rate limit from 60 to 5,000 req/hr)

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

### Run & Verify

```bash
npm run dev              # http://localhost:3000
npm run test             # Run deterministic unit tests (guards, normalizer, HMAC signing, URL parser)
npm run check-seed       # Verify self-audit seed claims & line citations
npm run check-benchmark  # Recompute & verify 72/72 benchmark results from raw runs
npm run verify           # Full gate: lint + check-seed + check-benchmark + test + next build
```

## How to use it

1. Paste the agent's last message (or click one of the **4 Scenario Presets**, or paste a GitHub PR/commit URL).
2. Paste the GitHub repo URL it was working on.
3. Click **Check Claims** — extraction → evidence + commit diffs → spec-drift + verbatim line check → verdicts appear claim by claim.
4. Optional: click **Edit / Refine Extracted Claims** to manually adjust extracted claims and re-verify without an extra extraction call.
5. **Copy PR Audit Markdown**, **Export Report (.md / .json)**, or **Generate Signed Permalink** for a tamper-evident Base64URL permalink.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/claim-source` | Fetches PR title/body or commit message from a GitHub URL |
| `POST /api/extract-claims` | Gemini extracts atomic checkable claims from the agent message |
| `POST /api/check-evidence` | GitHub REST API file tree, 60-file content pass, and commit diff lookup |
| `POST /api/check-spec-drift` | Contradiction & supporting-line check with server-side quote verification |
| `POST /api/generate-report` | Builds the HMAC-SHA256 signed Base64URL shareable report permalink |
| `POST /api/self-audit` | Runs VibeCheck's own 3 fixed claims against this repo |

## Docs

Planning and build docs live in [`devpost/`](devpost/):

- [`scope.md`](devpost/scope.md) — the idea, the POC boundary, what was cut
- [`prd.md`](devpost/prd.md) — product definition and core journey
- [`spec.md`](devpost/spec.md) — technical blueprint, data model, failure modes
- [`checklist.md`](devpost/checklist.md) — build slices, verification, and revision log
- [`app-map.html`](devpost/app-map.html) — standalone visual architecture map and 3-stop code tour

## License

[MIT](LICENSE)
