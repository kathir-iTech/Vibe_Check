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

- [ ] **6. Self-audit (published number, scoped down)**
  Becomes usable: The homepage shows a Self-Audit card with a genuine recorded run of VibeCheck checking 3 fixed claims about itself against `github.com/kathir-iTech/Vibe_Check`, plus an on-demand "Re-run live" button; `/api/self-audit` performs that run server-side.
  Why now: `scope.md > What "Working" Looks Like` and `prd.md > Product Decisions` both require the tool to run on its own repo as the proof. The full published number (8 past build logs) stays deferred; this is the self-contained version of it.
  PRD ref: `prd.md > Product Decisions`, `prd.md > Deferred From the POC`
  Spec ref: `spec.md > File Structure` (api routes), `spec.md > Components > RepoEvidenceChecker`, `spec.md > Components > SpecDriftDetector`, `spec.md > Look and Feel`
  Build: `/api/self-audit` route with 3 hardcoded claims (no Gemini extraction call) run through the existing `check-evidence` and `check-spec-drift` POST handlers by direct import — no duplicated logic. `src/lib/self-audit-seed.ts` holds the captured real response as the committed initial state. A `SelfAudit` card on the homepage renders the seed (claims, verdicts, evidence, timestamp); "Re-run live" POSTs once, on demand only — never on page load.
  Verify (mechanical): `npm run lint` and `npm run build` clean; one real POST to `/api/self-audit` pasted as the response; a second POST returns a different `runAt`; seed file matches the captured run.
  Learner check: Load the homepage and confirm the Self-Audit card shows a real result immediately (no spinner), then click "Re-run live" and confirm the timestamp updates.
  Commit: `Fix 6: self-audit`

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
