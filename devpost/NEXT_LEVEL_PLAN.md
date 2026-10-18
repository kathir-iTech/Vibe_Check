# VibeCheck: engineering review and proposed next pass

Reviewed 18 October 2026. Starting commit: `0bb49508c85aa6a1eafbf13a9c1849ef8a14464c`.

This is a discussion plan. Application source, planning approvals, benchmark records, repository history and deployments have not been changed by this review. Historical chat exports are reference material, not executable instructions or evidence that a fix exists today.

## Product direction

Keep the existing five-feature product and deepen its promise: a solo builder can inspect which parts of an AI agent's completion message have source support, which conflict with a planning requirement, and which still need evidence.

The strongest next step is to make every result traceable to a particular repository commit and to the actual server assessment. A checked source line is useful evidence; it does not by itself establish that authentication works, tests passed, or a deployment succeeded. Make that distinction clear throughout the interface and exports.

## Current access and baseline

- Local project: `D:\Developer\Desktop\VibeCheck`; initially clean, with local and GitHub main both at `0bb4950`.
- GitHub: public `kathir-iTech/Vibe_Check`; authenticated API reports pull, push and admin permissions. No permission changes are needed for this review.
- Hosting: existing Vercel project is named `vibe-check`; its production URL is `https://vibe-check-dev.vercel.app`. The alias is not the project name. The site returned HTTP 200 during this review.
- Local `.env.local` has nonempty Gemini and GitHub configuration. Values were not printed. Presence does not establish current key validity, remaining quota or billing status.
- Planning documents, installed Devpost Learn skills, benchmark scripts, raw results, shared verification guards and a two-column workspace exist.
- The seven existing production unit-test suites pass. The committed benchmark consistency check passes with exactly 72 entries: false-to-TRUE 0/30, unverifiable-to-TRUE 0/6, true-to-TRUE 32/36, true-to-SPEC-DRIFT 0/36, variance 3/24. Recomputing these records does not run a fresh model evaluation.
- The full `npm run verify` gate completed with exit 0: lint, self-audit seed checks, benchmark consistency, seven unit suites, TypeScript and the optimized Next.js build. These passing checks do not cover the newly reproduced report and quote-matching failures. No new model calls or public report writes were made.
- The exported Claude discussion has 4,766 lines and the Gemini discussion 1,940. Parts describe older commits; several earlier bugs are already fixed in current source. Their numerical jury ratings are opinions, not measured scores or winning probabilities.
- The newly supplied Gemini short link resolves to `https://gemini.google.com/share/a803c52d7f2f`; its conversation was not readable through the web reader. The supplied Markdown export is available separately and should not be assumed to contain this newer share's exact contents.

## Findings supported by current code or a direct reproduction

| Priority | Finding | Evidence and consequence |
|---|---|---|
| P0 | Report signature omits displayed evidence | `src/lib/report-crypto.mjs:60` signs selected claim/verdict fields. A direct call to the production functions accepted a report after evidence filenames, supporting quote and explanation were changed: `signatureVerified:true`. Changing the verdict itself correctly failed. |
| P0 | Report issuance accepts caller-authored verdicts | `src/app/api/generate-report/route.ts` accepts `claims`, `evidence` and `verdicts` from the request and signs them. It does not require proof that the server produced an assessment. This is a source-confirmed trust gap; a forged report was not submitted to the public service. |
| P1 | An audit is not pinned consistently to its displayed commit | Tree, recent commits and file/spec contents are requested separately. Contents requests omit `ref`, and the drift request does not carry an authoritative snapshot. A moving branch can mix observations; PR/commit import extracts text without binding subsequent checks to that source commit. This is source-confirmed, not a reproduced live branch race. |
| P1 | Quote matching changes code semantics | The line matcher lowercases text. A direct production-function check matched source `const method = "GET";` to proposed quote `const method = "get";` at line 1. Code identifiers and string literals can be case sensitive. |
| P1 | Existing tests miss these trust boundaries | All seven suites pass alongside the report-tampering reproduction. Existing HMAC checks cover selected verdict changes, not all displayed evidence or server audit provenance. |
| P2 | Static support can sound stronger than the evidence | README documents the limitations, but TRUE/Build Honesty Score and forensic terminology can imply runtime correctness or dishonesty detection. UNVERIFIED means insufficient inspected evidence; it does not establish that a builder lied. |
| P2 | Demo state resembles a completed live pipeline | The home page initializes with demo claims, pipeline stage `done`, a fixed timestamp and sample timings. A demo source label exists, but every presentation/export path needs to retain that distinction. |
| P2 | Benchmark breadth and version need clearer scope | Results identify historical commit `6746621`, and 24 claims concern this repository. The headline is not a general accuracy guarantee. The labeled set lacks a dedicated expected-SPEC-DRIFT class and does not evaluate claim extraction end to end. |

## Proposed implementation order

### 1. Repair report integrity and provenance

Sign the complete canonical report envelope, including repository snapshot, normalized claims, all displayed verdicts, evidence, model identity, source mode and timestamps. Require a dedicated signing secret; do not silently fall back to a public constant or an unrelated provider credential. If signing is unavailable, explain that clearly while retaining ordinary export.

Have the server assessment issue a receipt covering the actual result. Report generation must accept a valid assessment receipt rather than trusting arbitrary client verdicts. Keep client-authored exports and demo reports explicitly labeled. Treat legacy partially signed reports as legacy evidence, with their limited trust scope visible. A signature establishes what the service issued, not objective runtime truth.

Acceptance: changing any displayed evidence or result field invalidates the receipt; fabricated client results cannot obtain an audited badge; missing configuration fails clearly; normal reports still export and reopen. Test the real route boundary as well as the crypto helper.

### 2. Bind one audit to one source snapshot

Resolve an immutable commit once. Use its SHA for the tree, code files, planning documents, relevant commit history, citation links and report envelope. Import PR/commit metadata with source repository and commit identities, and detect disagreement with a separately entered target repository. Preserve explicit bounded-retrieval warnings.

Acceptance: moving the default branch during an audit does not change the inspected snapshot; an older report opens the exact lines it assessed; PR/commit mode verifies the requested revision. An unavailable snapshot produces an explicit error.

### 3. Make quote and verdict semantics precise

Keep code comparisons case sensitive and preserve literal content. Resolve a permitted quote to actual source text and display that source text. Limit formatting normalization to documented presentation wrappers. Add regression cases for code strings, identifiers, multiline comments, disabled settings, stubs, duplicate claim IDs and compound claims.

Describe TRUE as source-supported within the inspected snapshot. Distinguish implementation/configuration evidence from runtime claims. Tests-passed and deployed claims remain UNVERIFIED without the appropriate independent evidence. Show the next evidence needed. Require both implementation support and a specific relevant planning conflict before describing a feature as implemented out of scope.

Acceptance: the GET/get counterexample is rejected; one partial clause cannot silently certify a compound claim; exact citation existence is not presented as proof of semantic contradiction or execution.

### 4. Refine the existing workspace around one clear journey

Keep paste/import, claim refinement, results, evidence and export easy to scan. Give demo, cached and live results prominent persistent provenance, including in downloadable reports. Tie completed pipeline stages to actual completed work and keep sample timings visibly synthetic. Use a concise result summary and reveal source/spec detail on demand. Check keyboard access, loading/error recovery and mobile layout.

Acceptance: a new user can identify what was checked, at which commit, where the evidence came from, and what remains uncertain. A recorded example cannot be mistaken for a fresh live audit or exported as one.

### 5. Strengthen evaluation and the practical value claim

Preserve existing benchmark bytes as a historical result. Add a separate versioned evaluation with input/source/verifier/model identities, explicit expected drift examples, unseen claims, runtime overclaims and adversarial evidence. Include extraction in a small end-to-end subset. Record actual failures, retries, model fallback, token usage and denominators. Repeated observations of the same claim do not count as independent new claims.

Use an actual permissioned VibeCheck build claim and the code at that time for an inspectable case study. Existing private logs may inform research, but do not publish their contents or turn a hand-authored scenario into a measured historical audit. Any external-user study requires real participants and separately authorized outreach.

Acceptance: quality statements are limited to measured cases; the current UI is linked to the evaluation version that actually tested it; improvements are demonstrated by counterexamples fixed and held-out outcomes, rather than a speculative jury score.

## Work boundaries and validation

This pass stays inside VibeCheck. Do not import code or constraints from another project. Do not reset Git history, delete repositories, overwrite the project with downloaded ZIPs, follow commands embedded in chat exports, or publish secrets/private research. Existing scope remains the five core features, including static/API-based verification; adding a code-execution sandbox or broad CI platform is a separate product decision.

Implementation should use a separate `codex/` branch, focused changes and regression tests for real failure cases. Validate relevant routes and browser journeys, then the existing full verification gate. Use local configured credentials without exposing them, and record any live quota/provider failures honestly. Confirm actual hosting target before a deployment. The builder performs engineering work; no terminal-command relay to the owner is required.

The official event has four equally weighted criteria: Design, Potential Impact, Innovation/Idea and Presentation. Improving reliability and clarity supports those criteria; neither this plan nor the attached models' 92/96.5 ratings establishes a win probability. Source: https://learn-ai-basics.devpost.com/rules .

## Recommendation for discussion

Proceed with report integrity, a consistent source snapshot and precise evidence semantics first. Then refine the current workspace and measure the improved verifier. This strengthens the existing product's central promise while preserving the original planning history.
