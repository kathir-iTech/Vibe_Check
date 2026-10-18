---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast — learner issues scoped Fix prompts, agent builds/verifies/commits, learner reviews after push (confirmed by the Fix 6 prompt: "Send 'Fix 6 pushed' and I'll clone and check it").

## Evidence-workspace upgrade — approved 18 October 2026

The owner approved implementing the reviewed next-level plan and delegated implementation, verification, GitHub pushes and existing Vercel delivery. Continue fast mode. Preserve earlier planning and measured results; extend the five existing features with evidence provenance, requirement coverage and comparison. The static/API-only execution boundary remains. External user recruitment and personal submission/video actions remain outside implementation.

- [x] **21. Trustworthy evidence and reports**
  Becomes usable: Quotes preserve code semantics and reports cannot authenticate changed or client-invented audit results.
  Why now: Direct counterexamples defeat the current trust promise.
  PRD ref: `prd.md > Features and Behavior > Shareable Verdict Report`
  Spec ref: `spec.md > Data Model`, `spec.md > Important Failure Modes`
  Build: Complete versioned signatures, server audit receipts, strict payload and source quote validation.
  Verify (mechanical): Production-function and actual route tampering/forgery/missing-secret regression checks; typecheck and existing suite.
  Learner check: Open a verified report; change its evidence and observe rejection.
  Commit: `fix: bind reports to complete server audit evidence`

- [x] **22. One snapshot and precise evidence obligations**
  Becomes usable: An audit reads one commit and distinguishes source support from runtime claims and new changes.
  Why now: Requirements and comparisons need stable evidence identities.
  PRD ref: `prd.md > Features and Behavior > Repo Evidence Checker`
  Spec ref: `spec.md > Components`, `spec.md > Important Failure Modes`
  Build: Immutable GitHub snapshots, correct PR/commit targets, bounded coverage, requirements retrieval and server orchestration.
  Verify (mechanical): Snapshot movement, private-access, source mismatch, runtime overclaim and malformed-input checks; one real GitHub/Gemini audit.
  Learner check: Inspect every citation at the displayed commit and distinguish configuration from execution proof.
  Commit: `feat: audit claims and requirements at an immutable source revision`

- [x] **23. Clear audit, requirement and recheck workspace**
  Becomes usable: Inspect evidence, omissions, next actions and changes between audits; export results with persistent provenance.
  Why now: Makes the stronger verification accessible in the existing core journey.
  PRD ref: `prd.md > The Core Journey`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Components`
  Build: Accessible workspace, source labels, requirements map, result comparison, evidence export/import and interruption recovery.
  Verify (mechanical): Desktop/mobile browser workflows, keyboard/theme/error states, export/reimport and report integrity.
  Learner check: Run a claim, inspect its evidence and missing-proof request, then compare a recheck.
  Commit: `feat: build an evidence-first audit and recheck workspace`

- [x] **24. Reproducible adversarial evaluation**
  Becomes usable: Inspect current verifier tests and held-out model results without confusing them with historical benchmarks.
  Why now: New behavior needs measured evidence beyond curated examples.
  PRD ref: `prd.md > Product Decisions`
  Spec ref: `spec.md > Important Failure Modes`
  Build: Versioned adversarial cases, explicit drift/partial/runtime obligations, honest denominators and comparison records.
  Verify (mechanical): Evaluation recomputation and actual bounded live calls; preserve failures and historical raw data.
  Learner check: Compare source/version identities and inspect an actual failure as well as successes.
  Commit: `test: publish bounded current-verifier evaluation and limitations`

- [x] **25. Reviewed delivery**
  Becomes usable: The tested workspace is available from the existing public website and GitHub repository.
  Why now: Delivery must follow successful implementation and verification.
  PRD ref: `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: Reproduction/docs alignment, staged production deployment, hosted readbacks and release record.
  Verify (mechanical): Full verification gate, actual deployed browser/API/report checks, source identity and GitHub push checks.
  Learner check: Open the hosted app and try the audit journey; feedback can guide a subsequent focused revision.
  Commit: `docs: record verified evidence-workspace delivery`

## Slices

- [x] **1. Project scaffold and build passing**
  Becomes usable: `npm run build` and `npm run lint` complete with no errors on a Next.js + TypeScript + Tailwind scaffold following the spec's file structure.
  Why now: Every later slice needs a place to land; the stack is locked by the learner, so setup is pure mechanics.
  PRD ref: `prd.md > What We're Building`
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`
  Build: Scaffold the app per `spec.md > File Structure`, install `@google/genai`, add planning docs, API route shells, component shells, types.
  Verify (mechanical): `npm run build` and `npm run lint` exit clean.
  Learner check: Run `npm run dev`, open the app, confirm the input panel renders.
  Commit: `VibeCheck: planning docs, scaffold, Fix 1 (build passing)`

- [x] **2. Claim flow wired end to end**
  Becomes usable: Paste an agent message + repo URL, click Check Claims, and see extracted claims move through evidence checking and spec-drift detection to verdicts on screen.
  Why now: This is the unique kernel — claim extraction + evidence cross-reference — and it must come early.
  PRD ref: `prd.md > The Core Journey` (steps 1-6)
  Spec ref: `spec.md > Components > ClaimExtractor`, `spec.md > Components > RepoEvidenceChecker`, `spec.md > The Core Journey Through the System`
  Build: Implement `extract-claims`, `check-evidence`, `check-spec-drift` routes and the homepage state machine that calls them in sequence.
  Verify (mechanical): Dev server run against a real repo URL returns claims, evidence, and verdicts without errors.
  Learner check: Paste a real agent message and repo, click Check Claims, confirm verdicts appear.
  Commit: `Fix 2: flow wired`

- [x] **3. Verdict logic**
  Becomes usable: Every claim resolves to TRUE / UNVERIFIED / SPEC-DRIFT with a reason and, for drift, a file:line citation that is verified against real doc content.
  Why now: The verdict vocabulary is the product's whole promise; wrong verdicts make every later screen a lie.
  PRD ref: `prd.md > Features and Behavior > Spec-Drift Detector`
  Spec ref: `spec.md > Data Model` (`Verdict`), `spec.md > Components > SpecDriftDetector`
  Build: Branch logic in `check-spec-drift` — no evidence → UNVERIFIED, evidence + no docs → UNVERIFIED, evidence + docs → Gemini contradiction check → TRUE/SPEC-DRIFT; citation validation in `gemini.ts`.
  Verify (mechanical): A deliberately false claim returns UNVERIFIED; a contradicting claim returns SPEC-DRIFT with a real quoted line.
  Learner check: Feed the demo moment claim ("added auth, all tests pass") and confirm the red verdict plus missing-file pointer.
  Commit: `Fix 3: verdict logic`

- [x] **4. Demo mode and report export**
  Becomes usable: `?demo=1` drives the full flow with preloaded data, and results can be exported/shared as a report.
  Why now: The last two of the five locked features; also the fallback when GitHub/Gemini hiccups, which the failure modes require.
  PRD ref: `prd.md > Features and Behavior > Fallback Demo Mode`, `prd.md > Features and Behavior > Shareable Verdict Report`
  Spec ref: `spec.md > Components > DemoMode`, `spec.md > Components > ReportExporter`
  Build: `demo-data.ts`, demo page, `generate-report` route, `ReportExport` component, report permalink page.
  Verify (mechanical): `?demo=1` shows the full flow with no dead screens; a generated report opens at its permalink.
  Learner check: Open `?demo=1` and export a report; confirm both look right.
  Commit: `Fix 4: demo + reports`

- [x] **5. UI/design pass**
  Becomes usable: The whole app matches `spec.md > Look and Feel` — verdict colors, monospace evidence, dark mode, no inline styles.
  Why now: Presentation pass after behavior is correct, so styling reviews something real.
  PRD ref: `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`
  Build: Tailwind classes throughout, verdict badge styles, `role="status"` loading skeleton, `icons.tsx`, dark-mode variants.
  Verify (mechanical): `npm run build` + `npm run lint` clean; `grep -r "style={{"` returns zero; dark: variants present.
  Learner check: Open the app in light and dark mode; confirm verdict colors and evidence styling match the spec.
  Commit: `Fix 5: UI/design pass`

- [x] **6. Self-audit (published number, scoped down)**
  Becomes usable: The homepage shows a Self-Audit card with a genuine recorded run of VibeCheck checking 3 fixed claims about itself against `github.com/kathir-iTech/Vibe_Check`, plus an on-demand "Re-run live" button; `/api/self-audit` performs that run server-side.
  Why now: `scope.md > What "Working" Looks Like` and `prd.md > Product Decisions` both require the tool to run on its own repo as the proof.
  PRD ref: `prd.md > Product Decisions`, `prd.md > Deferred From the POC`
  Spec ref: `spec.md > File Structure` (api routes), `spec.md > Components > RepoEvidenceChecker`, `spec.md > Components > SpecDriftDetector`, `spec.md > Look and Feel`
  Build: `/api/self-audit` route with 3 hardcoded claims run through the existing `check-evidence` and `check-spec-drift` POST handlers by direct import. `src/lib/self-audit-seed.ts` holds the captured real response as the committed initial state.
  Verify (mechanical): `npm run lint` and `npm run build` clean; one real POST to `/api/self-audit` pasted as the response; a second POST returns a different `runAt`; seed file matches the captured run.
  Learner check: Load the homepage and confirm the Self-Audit card shows a real result immediately (no spinner), then click "Re-run live" and confirm the timestamp updates.
  Commit: `Fix 6: self-audit`

- [x] **7. PR/commit URL claim source**
  Becomes usable: Instead of typing the agent message, the builder can paste a GitHub PR or commit URL; the fetched title/body (or commit message) is fed into the existing extract-claims flow as the claim text.
  Why now: Learner-issued scope addition after Fix 6 — a second, lower-friction way to populate the claim box without touching the verified verdict routes.
  PRD ref: `prd.md > The Core Journey` (step 1, alternate input)
  Spec ref: `spec.md > Components > ClaimExtractor`, `spec.md > Where It Runs and How Someone Tries It`
  Build: `fetchClaimTextFromUrl` helper in `src/lib/github.ts`; new `/api/claim-source` route; homepage second input "or paste a PR/commit URL".
  Verify (mechanical): `npm run lint` + `npm run build` clean; a real public PR URL POSTed to `/api/claim-source` returns its real title/body.
  Learner check: Paste a real PR URL from any public repo, enter a repo URL, click Check Claims — confirm the fetched title/body appears and verdicts render.
  Commit: `Fix 7: PR/commit URL input`

- [x] **8. Client-side result caching**
  Becomes usable: A repeated identical submission is served from sessionStorage with zero network calls, visibly labeled "cached — Re-run live for a fresh check".
  Why now: Learner-issued scope addition after Fix 7 — saves Gemini/GitHub quota on repeated checks without hiding freshness.
  PRD ref: `prd.md > Features and Behavior`
  Spec ref: `spec.md > Important Failure Modes`
  Build: `src/lib/result-cache.ts` (FNV-1a key of message-or-PR-URL + repoUrl, try/catch read/write, fail open).
  Verify (mechanical): `npm run lint` + `npm run build` clean; second identical submission served with 0 fetch calls, and "Re-run live" issuing a real fetch.
  Learner check: Run the same check twice — the second shows the amber "cached" badge; click "Re-run live" and confirm the "live" badge returns.
  Commit: `Fix 8: client-side result caching`

- [x] **9. Gemini model fallback (quota doesn't dead-end the app)**
  Becomes usable: The primary model is tried first; on 429/503/404 the identical request is retried once on the stable `gemini-3.1-flash-lite`, and ResultsPanel shows an "answered by …" label.
  Why now: `gemini-3-flash-preview` free tier is 20 calls/day; fallback prevents quota exhaustion from dead-ending visitors.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > External Services and Dependencies`
  Build: `src/lib/gemini.ts` — `generateText()` retries once on `gemini-3.1-flash-lite` when `isFallbackWorthy(error)` is true.
  Verify (mechanical): `npm run lint` + `npm run build` clean; fallback returns `"model": "gemini-3.1-flash-lite", "modelFallback": true`.
  Learner check: Run a check and confirm the small "answered by …" label under Results.
  Commit: `Fix 9: model fallback`

- [x] **10. Verified-support TRUE**
  Becomes usable: TRUE requires a supporting quote found verbatim in a real file fetched from the repo.
  Why now: TRUE previously meant "file names matched keywords and no spec doc contradicted it", which was absence of contradiction rather than support.
  PRD ref: `prd.md > Features and Behavior > Spec-Drift Detector`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Components > RepoEvidenceChecker`, `spec.md > Data Model`
  Build: `lib/github.ts fetchFileContentsForClaims` + `validateAssessments` verifying `supportingQuote` via `findLineNumber`.
  Verify (mechanical): `npm run lint` + `npm run build` clean; TRUE card carries `→ file:line: <quoted line>`.
  Learner check: Run a check and confirm a TRUE card carries `→ file:line: <quoted line>` the way SPEC-DRIFT cards do.
  Commit: `Fix 10: verified-support TRUE`

- [x] **11. Content-based retrieval + honest UNVERIFIED reasons**
  Becomes usable: Evidence lookup scores claim keywords against file content (up to 60 text files), and UNVERIFIED cards show a deterministic reason string.
  Why now: Claims about code whose file name shares no keyword with the claim (e.g., `gemini.ts` for quote verification) needed content-level retrieval.
  PRD ref: `prd.md > Features and Behavior > Repo Evidence Checker`
  Spec ref: `spec.md > Components > RepoEvidenceChecker`
  Build: `selectContentCandidates` + `fetchRawFileTexts` in `src/lib/github.ts`; content scoring in `check-evidence`.
  Verify (mechanical): `npm run lint` + `npm run build` clean; `gemini.ts` retrieved for self-audit claim 3.
  Learner check: Open the self-audit and confirm claim 3's evidence lists `src/lib/gemini.ts`.
  Commit: `Fix 11: content-based retrieval`

- [x] **12. Prompt-injection hardening + restatement guard**
  Becomes usable: Untrusted blocks are wrapped in `<untrusted-NONCE>` delimiters, inputs are capped (8KB message, 15 claims, 300 chars), and quotes that merely restate the claim are rejected.
  Why now: Arbitrary PR bodies and repo file contents are embedded into prompts; restatement and nonce guards prevent planted claim restatements from becoming evidence.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`
  Build: `makeNonce()`, `untrusted()`, `truncateTo()`, and `isRestatement()` in `src/lib/gemini.ts`.
  Verify (mechanical): Throwaway injection PR tested and closed unmerged; restatement guard unit checks pass.
  Learner check: Confirm a restating quote is rejected with the restatement reason while genuine code lines return TRUE.
  Commit: `Fix 12: injection hardening + restatement guard`

## Hands-on Checkpoints

- [x] Early usable behavior explored — Fix 4 live Vercel HAR + screenshot verification (`vibe-check-dev.vercel.app`) and Fix 5 UI/design pass reviewed after push.
- [x] Final kick-the-tires exploration and feedback completed — Self-Audit live re-run, 24-claim benchmark card, 1-click scenario presets, interactive claim editor, commit diff inspection, and Markdown/JSON/permalink exports verified.

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete — focused investigation of server-side quote verification (`findLineNumber`), restatement guard (`isRestatement`), and SPEC-DRIFT keyword guard (`hasContradictionKeywords`) in `src/lib/gemini.ts` connected to deterministic unit tests in `scripts/test-core.mjs`.
- [x] Optional edit and transfer reflection addressed — covered during iterative verification of Fix 10 through Fix 18 (pairing LLM extraction/assessment with deterministic code post-conditions).
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Focused investigation tracing false-positive and false-accusation failure modes across `src/app/page.tsx` (`handleCheck`), `src/app/api/check-evidence/route.ts` (`POST`), and `src/lib/gemini.ts` (`validateAssessments`, `findLineNumber`, `isRestatement`, `hasContradictionKeywords`), backed by `scripts/test-core.mjs` and the 24-claim benchmark in `benchmark/results.json`.
Route and stops: Reference route documented in `devpost/app-map.html` covering Stop 1 (`src/app/page.tsx > handleCheck`), Stop 2 (`src/app/api/check-evidence/route.ts > POST`), and Stop 3 (`src/lib/gemini.ts > validateAssessments`).
Edit outcome: Kept; added `STOPWORDS` filtering to `tokenize`, fixed `contradictingLine` assignment order before `hasContradictionKeywords`, added Markdown bold and line-prefix normalization in `normalizeForLineMatch`, and verified with `npm run test` and `npm run check-benchmark`.
Reflection: Already covered through the build's core takeaway — never trust an agent's self-reported completion or raw model judgment without a deterministic code check against the real artifact.
Activity mode: Focused alternative + reference app map (`devpost/app-map.html`).

## Revisions

- 18 October evidence-workspace delivery: owner inspected the workspace and requested shorter copy and a distinct theme/font/color identity. Those changes were applied and mechanically verified. Current delivery evidence is in `BUILD_STATUS.md` and `benchmark/v2/delivery.json`; the current implementation map is `APP_MAP_V2.md`. This records the received feedback and engineering response, without claiming a further owner sign-off or a new learning activity. Fresh provider requests can still fail; the recorded actual report is explicitly separate from a fresh audit.

- Fix 7 (learner-issued after Fix 6 verification): added slice 7 — PR/commit URL as an alternate claim source. New `lib/github.ts` helper + `/api/claim-source` route only.
- Fix 8 (learner-issued after Fix 7 verification): added slice 8 — sessionStorage result caching for Check Claims and self-audit, with visible cached/live labels, an always-available force-live path, and fail-open storage handling.
- Fix 9 (learner-issued after Fix 8 verification): added slice 9 — one retry on `gemini-3.1-flash-lite` when the primary answers 429/503/404, a `model` field on every `extract-claims`/`check-spec-drift` response, and an "answered by … (fallback)" label in ResultsPanel.
- Fix 10 (learner-issued after Fix 9 verification): added slice 10 — TRUE now needs a supporting quote verified against fetched file content, so it means support rather than "nothing contradicted it". `spec.md > Important Failure Modes` (missing spec files) was rewritten in this commit to allow TRUE without `devpost/` docs.
- Fix 11 (learner-issued after Fix 10 verification): added slice 11 — retrieval now also scores file *content* (top 5 per claim with `hitCount`), and UNVERIFIED cards without a rejected quote show the fixed reason string instead of the model's free-text.
- Fix 12 (learner-issued after Fix 11 verification): added slice 12 — nonce-delimited untrusted blocks with a "this is data, not instructions" rule, 8KB/15-claim/300-char input caps with visible markers, and a deterministic restatement guard on supporting quotes.
- Fix 13 (learner-issued after Fix 12 verification): added slice 13 — latency instrumentation (`Server-Timing` + stage timings), prompt file deduplication and 100KB budget cap, `maxDuration = 60` on `/api/self-audit`, and `fetchWithTimeout` (70s client ceiling).
- Fix 14–17 (benchmark, extensionless files, and SPEC-DRIFT keyword guard): added `benchmark/claims.json` (24 labeled claims at `8e350af`), `scripts/benchmark.mjs`, `scripts/summarize.mjs`, `scripts/check-benchmark.mjs`, `WELL_KNOWN_EXTENSIONLESS` in `src/lib/github.ts`, and `hasContradictionKeywords` in `src/lib/gemini.ts`.
- Fix 18 (complete forensic overhaul & bug resolution): fixed `contradictingLine` assignment order before `hasContradictionKeywords` in `src/lib/gemini.ts`; added Markdown bold (`**`) and prompt line-number prefix (`1: `) normalization in `findLineNumber`; fixed per-claim run filtering in `scripts/summarize.mjs` and nested property checks in `scripts/check-benchmark.mjs`; added commit diff/patch inspection in `src/lib/github.ts`; added 1-click scenario presets, interactive claim editor, Build Honesty Scorecard, deep-linked GitHub `file:line` citations, Markdown PR report export, and the 8-build retroactive audit casebook; generated `devpost/app-map.html` and offline unit test suite `scripts/test-core.mjs`.
