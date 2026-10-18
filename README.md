# VibeCheck

**Before you accept “done,” inspect the evidence.**

VibeCheck helps solo builders review an AI coding agent's handoff. Paste its completion message, enter atomic claims, or import a GitHub PR/commit. The server inspects one fixed source revision and returns source citations, planning conflicts, missing evidence and a review of unmentioned requirements.

[Open the workspace](https://vibe-check-dev.vercel.app) · [Recorded real audit](https://vibe-check-dev.vercel.app/proof) · [Evaluation & limits](https://vibe-check-dev.vercel.app/evaluation) · [Build record](BUILD_STATUS.md)

[Recorded live audit](https://vibe-check-dev.vercel.app/proof) provides an explicitly labeled actual public-source observation and its original verifiable report without another model call. Its builder-supplied test requirement is disclosed. It is separate from the illustrative example and from a fresh audit.

Built for **Build With AI: Basics** using the Devpost Learn Skill Pack. Original scope, PRD, spec and learning/build history remain in [devpost/](devpost/).

## Try one handoff

1. Open the workspace and paste your agent's message, or use **Try an example** to inspect illustrative results.
2. Enter a public GitHub repository. For private source, use your own authorized read token in the advanced options.
3. Optionally select **Review extracted claims first** to edit the atomic claims before source inspection. Select **Check the proof** to run the audit.
4. Inspect each claim's evidence and next step. Open **Requirements** for explicit planning statements absent from the completion message.
5. Download JSON, copy PR Markdown or copy a verified report link. Imported and shared signed reports are checked against the service's public key before they are displayed. A restored tab copy is labeled separately.
6. Use **Inspect more evidence** to retain a finding's revision and add up to eight relevant paths under Advanced options. Hints guide inspection and are labeled as user-supplied.
7. Copy a **Repair handoff** for unresolved claims and their acceptance evidence. After an actual fix, select **Recheck latest revision**. **Compare** matches exact normalized text or lets you explicitly confirm equivalence. It rejects cross-repository comparisons and does not infer improvement from changed review context, a different verifier or unchanged source.

**Clear this tab** removes the draft, optional token, requirements, recovery checkpoint and assessment together. Theme preference is independent of the workspace draft. Detailed benchmark methodology lives on the evaluation page so the first screen stays focused on the handoff.

The example uses disclosed illustrative data and makes no model calls. It cannot receive a live-audit receipt. Live provider failures produce explicit errors; they never silently become an example or a successful result.

## What the findings mean

| Internal result | Workspace label   | Meaning                                                                                                                      |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TRUE            | Source supported  | A supporting line was checked against inspected source. Runtime behavior is not certified.                                   |
| PARTIAL         | Partial support   | Some support exists, but the full claim or claimed change is not established.                                                |
| UNVERIFIED      | Needs evidence    | The inspected material does not establish the claim. This does not prove the claim is false.                                 |
| SPEC-DRIFT      | Planning conflict | Cited source support conflicts with a cited planning line. Most conflicts remain model judgments; an exact supplied license prohibition also has a narrow manifest check. |

A test script cannot prove a test run passed. A source file cannot prove a deployment succeeded. GitHub check-run records, when accessible, are shown as attributed provider observations at the selected SHA; generic “all tests passed” claims remain unverified without sufficient specific execution evidence.

Requirement extraction examines up to 32 normative prose statements and acceptance items, including numbered lists; advisory wording is labeled and fenced code is skipped. Exact conflict citations take precedence. Lexical associations and limited aliases are review aids; possible matches remain suggestions, never fulfillment certificates. Implicit requirements, complex tables and omitted material still need human review.

## Evidence boundaries

- Resolve one immutable Git SHA and use it for source, tree, planning documents and citations.
- PR/commit imports select the actual source revision. An explicitly entered unrelated target is rejected.
- Source retrieval inspects up to 60 initial candidates and 16 tree-listed relative import targets. Assessment can focus a 20KB window around claim identifiers in source scanned up to 512KB; package manifests allow a 64KB window. Original line numbers and whole-source comment checks are retained. Finite request/context budgets still apply. Explicit hints prioritize up to eight readable source paths. Secrets, generated files and excluded evidence paths remain ineligible. Coverage and omissions are reported.
- A supplied comparison base must be a valid ancestor. An observed added supporting line is narrower evidence than “the feature was newly implemented.”
- Quote checks preserve case and literal whitespace. Comment, restatement and disabled-setting guards are defensive heuristics, not a proof of program semantics.
- Additional checks parse package manifests, reject mismatched dependency/license subjects, and cap support from imports, declarations, documentation and universal claims. A dependency declaration does not establish an integrated feature. These checks only limit model support; they do not promote a model rejection into success.
- When a model-supported, fully checked manifest license matches an explicit supplied license prohibition, a deterministic check surfaces the conflict and its exact review line. It excludes conditional/negated rules, fenced examples, repository prose, partial evidence and compound SPDX expressions. It compares declarations with review constraints; it does not assess legal licensing obligations.
- **No repository code is executed.** Prompt delimiters, quote checks and bounded inputs reduce some attacks; they do not eliminate prompt injection or model mistakes.
- A public service token cannot grant an anonymous visitor private repository access. Private inspection requires the visitor's own GitHub authority.

## Complete signed reports

Verifier v2 signs the complete report with Ed25519 using a dedicated `REPORT_SIGNING_SECRET`. Filenames, quotations, explanations, verdicts, provenance, model information and source identities are covered. The report endpoint refuses caller-authored verdicts without a valid server audit receipt.

A signature authenticates what this service issued. It does not prove that a model's conclusion is correct. Legacy partial HMAC signatures are not promoted to complete-report provenance.

New share links keep report data in the URL fragment at `/report/view`. Anyone given a link can read its included source excerpts. Review private material before sharing. Browser working state is stored only in the current tab; optional GitHub tokens are never cached or exported.

Claims and matched source excerpts are sent to Google Gemini for assessment. A visitor's GitHub token is used for authorized GitHub reads, not included in model prompts. Review the source-sharing implications before inspecting private repositories.

Verify downloaded JSON without installing project dependencies:

```sh
node scripts/verify-report.mjs audit.json trusted-key.json
```

Obtain and pin `trusted-key.json` separately from the trusted service's `/api/report-key` endpoint. A public key supplied by an untrusted report sender is not an independent trust anchor. No private key, model key, GitHub credential or network connection is needed for verification after those files are obtained.

## Run locally

Tested with Node.js 24 and npm. Use a current Chrome installation for the browser suite.

```sh
git clone https://github.com/kathir-iTech/Vibe_Check.git
cd Vibe_Check
npm ci
```

Create ignored `.env.local` using `.env.example` as the variable-name guide:

```dotenv
GEMINI_API_KEY=your-key
GITHUB_TOKEN=optional-server-token-for-public-reads
REPORT_SIGNING_SECRET=your-dedicated-random-secret-at-least-32-characters
```

`GEMINI_PRIMARY_MODEL` optionally selects the primary Google model. The service reports actual model/fallback use. Provider attempts are explicitly bounded and provider availability is not guaranteed. Do not place credentials in `NEXT_PUBLIC_` variables or commit local environment files.

Extraction and assessment request explicit JSON schemas. Empty, malformed or structurally invalid output gets at most one fallback attempt; conservative evidence rejections remain valid outcomes and do not trigger a retry for a positive answer. Two invalid responses stop with a clear error and preserve the draft.

```sh
npm run dev
npm run verify
npm run test:browser
```

For a local production server, run `npm run build` followed by `npm start`. Pass `-- --port 3018` to `npm start` to use the browser suite's default port.

The browser suite starts/reuses port 3018. Production verification, including actual model use, is separate from controlled browser fixtures. `BASE_URL` selects an existing deployment for browser checks.

## Evaluation and reproducibility

- [Historical model benchmark](benchmark/results.json): 24 curated claims × 3 repeats on this repository. Its measured 0/30 false-to-TRUE and 32/36 true-to-TRUE outcomes concern the recorded historical implementation, not current universal accuracy.
- `npm run check-benchmark` recomputes that historical summary from its raw records.
- `node scripts/evaluate-verifier.mjs` recomputes the current manufactured regression comparison using actual preserved legacy and current production functions/routes. It also checks declared source hashes.
- `node scripts/evaluate-verifier.mjs --write` records a new manufactured result after intentional verifier changes; review the changed inputs and results before publication.
- [Earlier live source observations](benchmark/v2/live-evaluation.json): eight labeled claims across pinned Express and Chalk revisions matched their expected outcomes. These selected builder requests use actual GitHub and Gemini responses. They are separate from the manufactured regression cases and historical benchmark.
- `node scripts/live-evaluation.mjs` runs another explicit provider-consuming observation against a local service. Archive the existing records first; this intentionally writes a new run.
- [Build record](BUILD_STATUS.md) discloses actual live-provider observations, setup/test failures and limits. Controlled tests, illustrative examples and real provider runs are labeled separately.
- [Product backlog and limits](devpost/PRODUCT_STATUS.md) maps the authorized improvements to their implementation and remaining evidence gaps.
- [Frozen six-repository plan](benchmark/v3/plan.json) contains 33 builder-authored evidence-class expectations. `node scripts/run-product-evaluation.mjs NEW-RUN-NAME` runs actual provider requests through the production assessment handler and retains each attempt. It supplies explicit source paths, so it does not measure automatic retrieval quality. Its baseline is the same raw model answer before deterministic validation, not a competing product.
- [Latest retained live cohort](benchmark/v3/summary.json): six requests completed and matched 32/33 expectations; raw model answers matched 33/33. A corrected-validator replay matched 33/33 with no new model calls. Earlier request failures and the subsequent browser capacity failure remain recorded separately.
- [Final product and rule audit](devpost/FINAL_AUDIT.md) records the checked Devpost requirements, cleanup scope and limits. Presentation, video and submission quality are excluded from the product assessment.
- [Independent observation protocol](devpost/product-observation.md) defines user-comprehension, changed-decision and timing observations. Those sessions remain pending; automated checks are not independent users.

No population success rate, independent-user adoption, financial savings or numerical winning probability is established. External testing would strengthen the impact evidence, but is not fabricated from the builder's own runs.

## Main interfaces

| Route                        | Purpose                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| POST `/api/audit`            | Server-orchestrated audit; JSON or NDJSON progress                       |
| POST `/api/check-evidence`   | Immutable source retrieval and coverage                                  |
| POST `/api/check-spec-drift` | Source-supported assessments and evidence obligations                    |
| POST `/api/claim-source`     | Legacy text-only source import; the workspace uses revision-bound import |
| POST `/api/generate-report`  | Validate an existing server audit receipt and produce a fragment link    |
| GET `/api/report-key`        | Public Ed25519 verification key                                          |
| GET `/api/health`            | Configuration/version information; not a completed provider check        |

## License

[MIT](LICENSE). Third-party framework and SDK licenses remain their own.

Self-hosted DM Sans and Space Grotesk come from the Google Fonts repository and retain their SIL Open Font License notices in `public/fonts/`.
