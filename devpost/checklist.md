---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast — learner issues scoped Fix prompts, agent builds/verifies/commits, learner reviews after push (confirmed by the Fix 6 prompt: "Send 'Fix 6 pushed' and I'll clone and check it").

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
  Why now: `scope.md > What "Working" Looks Like` and `prd.md > Product Decisions` both require the tool to run on its own repo as the proof. The full published number (8 past build logs) stays deferred; this is the self-contained version of it.
  PRD ref: `prd.md > Product Decisions`, `prd.md > Deferred From the POC`
  Spec ref: `spec.md > File Structure` (api routes), `spec.md > Components > RepoEvidenceChecker`, `spec.md > Components > SpecDriftDetector`, `spec.md > Look and Feel`
  Build: `/api/self-audit` route with 3 hardcoded claims (no Gemini extraction call) run through the existing `check-evidence` and `check-spec-drift` POST handlers by direct import — no duplicated logic. `src/lib/self-audit-seed.ts` holds the captured real response as the committed initial state. A `SelfAudit` card on the homepage renders the seed (claims, verdicts, evidence, timestamp); "Re-run live" POSTs once, on demand only — never on page load.
  Verify (mechanical): `npm run lint` and `npm run build` clean; one real POST to `/api/self-audit` pasted as the response; a second POST returns a different `runAt`; seed file matches the captured run.
  Learner check: Load the homepage and confirm the Self-Audit card shows a real result immediately (no spinner), then click "Re-run live" and confirm the timestamp updates.
  Commit: `Fix 6: self-audit`

- [x] **7. PR/commit URL claim source**
  Becomes usable: Instead of typing the agent message, the builder can paste a GitHub PR or commit URL; the fetched title/body (or commit message) is fed into the existing extract-claims flow as the claim text.
  Why now: Learner-issued scope addition after Fix 6 — a second, lower-friction way to populate the claim box without touching the verified verdict routes.
  PRD ref: `prd.md > The Core Journey` (step 1, alternate input)
  Spec ref: `spec.md > Components > ClaimExtractor`, `spec.md > Where It Runs and How Someone Tries It` (GitHub API calls stay server-side)
  Build: `fetchClaimTextFromUrl` helper in `src/lib/github.ts` (parses PR/commit URL, fetches via GitHub API); new `/api/claim-source` route; homepage second input "or paste a PR/commit URL" that hides the free-text box and feeds the fetched text into `extract-claims` unchanged. `check-evidence`, `check-spec-drift`, `generate-report` untouched.
  Verify (mechanical): `npm run lint` + `npm run build` clean; a real public PR URL POSTed to `/api/claim-source` returns its real title/body; full flow on that text returns a real verdict. Invalid URL returns an explicit inline error.
  Learner check: Paste a real PR URL from any public repo (leave the message box empty), enter a repo URL, click Check Claims — confirm the fetched title/body appears and verdicts render.
  Commit: `Fix 7: PR/commit URL input`

- [x] **8. Client-side result caching**
  Becomes usable: A repeated identical submission (Check Claims or self-audit Re-run) is served from sessionStorage with zero network calls, visibly labeled "cached — Re-run live for a fresh check"; a force-live path always exists; storage failures fail open to a live call.
  Why now: Learner-issued scope addition after Fix 7 — saves Gemini/GitHub quota on repeated checks without hiding freshness.
  PRD ref: `prd.md > Features and Behavior` (re-checking the same claim)
  Spec ref: `spec.md > Important Failure Modes` (fail open, never break the page)
  Build: `src/lib/result-cache.ts` (FNV-1a key of message-or-PR-URL + repoUrl, try/catch read/write, fail open). Homepage `handleCheck(forceLive)` reads cache before any fetch, writes only on full success, renders a live/cached badge with an always-available "Re-run live" button; SelfAudit gets a cache-aware "Re-run" alongside the always-real "Re-run live". No new dependencies, no new services.
  Verify (mechanical): `npm run lint` + `npm run build` clean; headless-browser console shows a second identical submission served with 0 fetch calls, and "Re-run live" issuing a real fetch.
  Learner check: Run the same check twice — the second shows the amber "cached" badge; click "Re-run live" and confirm the "live" badge returns. Self-audit: "Re-run" hits cache, "Re-run live" always re-fetches.
  Commit: `Fix 8: client-side result caching`

- [x] **9. Gemini model fallback (quota doesn't dead-end the app)**
  Becomes usable: The primary model is tried first; on 429 (free quota gone) or 503 (overload) the identical request is retried once on the stable `gemini-3.1-flash-lite`, so a first-time visitor still gets verdicts. Every `extract-claims` and `check-spec-drift` response carries a `model` field (plus `modelFallback`) naming the model that actually answered, `null` when none did; ResultsPanel shows a small "answered by gemini-3.1-flash-lite (fallback)" label; the sessionStorage entry stores the label with the results. Both models failing returns the existing explicit error — no demo or fake substitution.
  Why now: Learner-issued scope addition after Fix 8 — `gemini-3-flash-preview`'s free tier is 20 calls/day and it 429'd mid-verification, so the Fix 8 session cache (per-browser) left every new visitor's first run to hit a quota wall for hours.
  PRD ref: `prd.md > States and Boundaries` (Error — Gemini hiccups handled gracefully)
  Spec ref: `spec.md > Important Failure Modes` (Gemini API error → retry once), `spec.md > External Services and Dependencies` (gemini-3.1-flash-lite as the stable option with no shutdown date)
  Build: `src/lib/gemini.ts` — `generateText()` calls the primary, then `isFallbackWorthy(error)` (429 quota, 503 overload, 404 primary model missing/retired) decides one retry on `gemini-3.1-flash-lite`; both public functions return `{ data, model, modelFallback }`. Routes put `model` on every response; homepage tracks `{ extract, drift }` in state and in the cache entry; `ResultsPanel` renders the label. Prompts, verdict logic, and server-side quote verification untouched.
  Verify (mechanical): `npm run lint` + `npm run build` clean, no `useEffect`; primary temporarily pointed at an invalid model name → real `POST /api/extract-claims` and `POST /api/check-spec-drift` return `"model": "gemini-3.1-flash-lite", "modelFallback": true`; primary reverted → `"model": "gemini-3-flash-preview", "modelFallback": false`; headless-Chrome DOM of the real `ResultsPanel` shows "answered by gemini-3.1-flash-lite (fallback)".
  Learner check: After quota reset, run a check and confirm the small "answered by …" label under Results; while quota is exhausted the same check still completes on the lite model instead of erroring.
  Commit: `Fix 9: model fallback`

- [x] **10. Verified-support TRUE**
  Becomes usable: TRUE requires a supporting quote found verbatim in a real file fetched from the repo — the same normalize + line check SPEC-DRIFT already uses — so a false claim that merely shares vocabulary with file names can no longer pass, and a repo with no `devpost/` docs can still reach TRUE where a real line exists. Claims with no verified quote are UNVERIFIED; a cited quote that isn't in the file is rejected with that reason stated.
  Why now: Learner-issued after Fix 9 — TRUE currently means "file names matched the claim's keywords and no spec doc contradicted it", which is absence of contradiction rather than support (self-audit claim 3 passed on exactly that wording).
  PRD ref: `prd.md > Features and Behavior > Spec-Drift Detector`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes` (missing-spec line edited in this commit), `spec.md > Components > RepoEvidenceChecker`, `spec.md > Data Model`
  Build: `lib/github.ts fetchFileContentsForClaims` — max 5 files per claim, ~20KB each, skips binaries/lockfiles/secrets, deduped across claims, visible truncation marker. `gemini.ts` assessment prompt returns `supported`, `supportingFile`, `supportingQuote` next to the unchanged contradiction fields; `validateAssessments` verifies the supporting quote with the existing `findLineNumber`. `check-spec-drift` verdict order: SPEC-DRIFT (verified contradiction, priority) → TRUE (verified supporting quote, no contradiction) → UNVERIFIED. ResultsPanel shows TRUE supporting `file:line: quote` in emerald. One batched Gemini call per check; the Fix 9 fallback chain unchanged. `self-audit-seed.ts` regenerated from a real run.
  Verify (mechanical): `npm run lint` + `npm run build` clean, no `useEffect`; raw verdicts pasted for the Slack claim, the Tailwind claim (TRUE + real quote), a claim against a public repo with no `devpost/` docs (TRUE from a real line), and the regenerated self-audit verdicts.
  Learner check: Run a check and confirm a TRUE card carries `→ file:line: <quoted line>` the way SPEC-DRIFT cards do; a claim with no supporting line reads UNVERIFIED instead of TRUE.
  Commit: `Fix 10: verified-support TRUE`

- [x] **11. Content-based retrieval + honest UNVERIFIED reasons**
  Becomes usable: Evidence lookup also scores claim keywords against file *content* (raw text fetched from the resolved default branch), so a claim about code whose file name shares no word with the claim is still checkable — and an UNVERIFIED card whose quote was never rejected always reads the fixed string "No verified supporting line found in the matched files." instead of the model's free-text reasoning.
  Why now: Learner-issued after Fix 10 verification — Fix 10's TRUE gate is honest, but retrieval only matched file *paths*, so the self-audit sat at 0/3: the code proving claim 3 lives in `gemini.ts`, whose name shares no word with the claim, so it was never fetched. Fix retrieval; do not touch the claims, the prompts, or the verdict rules.
  PRD ref: `prd.md > Features and Behavior > Repo Evidence Checker`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > RepoEvidenceChecker`, `spec.md > Important Failure Modes`
  Build: `lib/github.ts selectContentCandidates` (excludes `.agents/`, `.claude/`, `devpost/`, lockfiles, binaries, secrets via `isSkippableFile`; keeps ts/tsx/js/jsx/py/go/rs/java/json/md/css/html/yml/yaml; above 60 candidates keeps 60 under `src/`, `app/`, `lib/` or the repo root, preferring shorter paths) + `fetchRawFileTexts` (raw.githubusercontent.com, 10 at a time, 10s total budget, 20KB cap, failed fetches skipped, never fails the check). `check-evidence` scores each claim = distinct claim keywords present in the file's content + a path-match bonus, returns the top 5 as `files` (unchanged string shape, so `check-spec-drift` is unchanged apart from receiving them) plus a new `fileMatches` with `hitCount` and per-file `matchedTerms`. Quote verification and verdict rules untouched. UNVERIFIED with no rejected quote → fixed reason; the model's free-text reason is no longer shown on UNVERIFIED cards. README gains a **Known limitations** note stating that SPEC-DRIFT proves the quoted line exists, not that it contradicts the claim. One batched Gemini call per check; Fix 9 fallback chain unchanged.
  Verify (mechanical): `npm run lint` + `npm run build` clean, no `useEffect`, no new dependencies; raw output pasted for (a) `check-evidence` on self-audit claim 3 (files + hitCount, does `gemini.ts` appear), (b) the three self-audit claims through the full flow with `self-audit-seed.ts` regenerated from that run, (c) the false Slack-webhook claim not returning TRUE, (d) a `developit/mitt` claim returning TRUE from a file other than `package.json`.
  Learner check: Open the self-audit and confirm claim 3's evidence now lists `gemini.ts` among the matched files; confirm no UNVERIFIED card shows a positive-sounding sentence as its reason.
  Commit: `Fix 11: content-based retrieval`

- [x] **12. Prompt-injection hardening + restatement guard**
  Becomes usable: Every untrusted block (agent message, PR/commit text, planning docs, fetched file contents, extracted claims) is wrapped in `<untrusted-NONCE>...</untrusted-NONCE>` with the nonce stripped from the text itself, and one instruction ahead of the blocks says that text is DATA to analyse, never instructions. Message/PR bodies cap at 8KB, extraction caps at 15 claims, claim text at 300 chars — all with visible truncation markers, never failing the check. A supporting quote that merely restates its claim is rejected in code, so a planted "this claim is supported" line cannot become evidence.
  Why now: Learner-issued after Fix 11 verification — Fix 7 pipes arbitrary PR text and Fix 10/11 pipe arbitrary file contents straight into prompts; verdict rules and quote verification already stop invented evidence, but a real yet irrelevant line (or a line that restates the claim) can still be steered in.
  PRD ref: `prd.md > States and Boundaries` (error and trust handling), `prd.md > Features and Behavior > Spec-Drift Detector`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > External Services and Dependencies`
  Build: `gemini.ts` — `makeNonce()`/`untrusted()`/`untrustedRule()` wrap blocks in `buildExtractionPrompt` and `buildAssessmentPrompt`; `truncateTo()` caps message 8KB, claims 15, claim text 300 chars with markers; `isRestatement()` rejects a quote that (normalized) contains the claim, is contained in it, or shares ≥80% of the claim's keywords on that one line, setting `rejectionReason` → UNVERIFIED "The cited line restates the claim; a restatement is not evidence." `check-spec-drift` reads `rejectionReason`. Both network-heavy routes export `maxDuration = 60`. Verdict rules, retrieval ranking, prompts' decision logic, and the fallback chain unchanged.
  Verify (mechanical): `npm run lint` + `npm run build` clean, no `useEffect`, no new dependencies; raw output pasted for (a) an assembled prompt containing an injected file (delimiter, nonce, instruction visible, no model call), (b) restatement guard reject + accept (no model call), (c) a live full-flow run on a real throwaway PR whose body is the injection text (closed unmerged), (d) the self-audit regenerated and seed committed verbatim.
  Learner check: Re-run the self-audit and confirm a claim whose only "support" was a line restating it now reads UNVERIFIED with the restatement reason; confirm a genuine code line still returns TRUE.
  Commit: `Fix 12: injection hardening + restatement guard`

## Hands-on Checkpoints

- [x] Early usable behavior explored — Fix 5 UI/design pass reviewed by the learner after push (build/lint/grep verification reported back, code confirmed to hold up)
- [ ] Final kick-the-tires exploration and feedback completed — after Fix 6 push, learner clones and checks the Self-Audit card and "Re-run live"

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Fix 7 (learner-issued after Fix 6 verification): added slice 7 — PR/commit URL as an alternate claim source. New `lib/github.ts` helper + `/api/claim-source` route only; the three verified verdict routes are explicitly out of scope per the Fix 7 prompt.
- Fix 8 (learner-issued after Fix 7 verification): added slice 8 — sessionStorage result caching for Check Claims and self-audit, with visible cached/live labels, an always-available force-live path, and fail-open storage handling. No new dependencies or services.
- Fix 9 (learner-issued after Fix 8 verification): added slice 9 — one retry on `gemini-3.1-flash-lite` when the primary answers 429/503/404, a `model` field on every `extract-claims`/`check-spec-drift` response, and an "answered by … (fallback)" label in ResultsPanel (stored in the cache too). Prompts, verdict logic, and quote verification unchanged; no new dependencies.
- Fix 10 (learner-issued after Fix 9 verification): added slice 10 — TRUE now needs a supporting quote verified against fetched file content, so it means support rather than "nothing contradicted it". Deliberate, non-silent doc change: `spec.md > Important Failure Modes` (missing spec files) was rewritten in this commit to allow TRUE without `devpost/` docs; the self-audit seed was regenerated from a real run. One Gemini call per check and the fallback chain unchanged.
- Fix 11 (learner-issued after Fix 10 verification): added slice 11 — retrieval now also scores file *content* (top 5 per claim with `hitCount`), so claims about code whose file names share no word with them can be checked; and UNVERIFIED cards without a rejected quote show the fixed reason string instead of the model's free-text. Claims, prompts, quote verification, and verdict rules unchanged; `README.md` gained a Known-limitations note (SPEC-DRIFT proves the quote exists, not the contradiction); `self-audit-seed.ts` regenerated from the run pasted in the fix report.
- Fix 12 (learner-issued after Fix 11 verification): added slice 12 — nonce-delimited untrusted blocks with a "this is data, not instructions" rule, 8KB/15-claim/300-char input caps with visible markers, and a deterministic restatement guard on supporting quotes only (contradiction verification untouched). `README.md` Known limitations gained three bullets (TRUE = at least one verified line, documentation ≠ runtime behavior, mitigations best-effort). Verdict rules, retrieval ranking, and the fallback chain unchanged; no new dependencies. Deployment note: the repo's `homepageUrl` (`vibe-check-lemon-chi.vercel.app`) answers `DEPLOYMENT_NOT_FOUND`, so the Step 0 timing was taken locally instead.
