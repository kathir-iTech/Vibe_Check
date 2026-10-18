# Final product audit — 18 October 2026

Scope: VibeCheck website, source, reproduction and public delivery. Video, pitch and submission quality are excluded. This document records engineering findings, not submission copy or an official jury score.

## Rule check

Reviewed the [official rules](https://learn-ai-basics.devpost.com/rules), [overview](https://learn-ai-basics.devpost.com/) and [resources](https://learn-ai-basics.devpost.com/resources) on 18 October 2026.

- The official rules govern discrepancies with the overview. Stage One requires a viable end-to-end project and the Devpost Learn Skill Pack, evidenced by scope.md, prd.md and spec.md. This public repository retains those original documents, the installed skill-pack sources and skills-lock.json. Its first recorded commit is 29 September 2026, inside the 22 September–26 October submission period. Git history alone cannot independently establish authorship or the absence of earlier private work.
- The repository is public and GitHub detects its MIT license. Source, assets, font licenses, dependency lockfile and local installation instructions are present. Third-party frameworks, SDKs, fonts and the learning skill pack are disclosed. No repository was made public or paid service activated in this audit.
- The deployed website is accessible anonymously. Fresh GitHub/AI inspection uses third-party services; recorded actual reports can be inspected without another AI request. Access must remain available through judging. A single successful check cannot promise future provider availability.
- The deadline is 26 October 2026 at 5:00 pm EDT (27 October, 2:30 am IST). The official rules separately require an English description and a public video under three minutes. Those are outside this product audit; their completion is not asserted.
- Legal age, individual eligibility, originality declarations, authorization for third-party usage and final form completion are not certified by an automated code review.

## Assessment scope

Official Stage Two criteria are equally weighted Design, Potential Impact, Innovation/Idea and Presentation. At the owner's request, this assessment omits Presentation completely and normalizes the remaining three equally. It is a subjective product review, not a measured probability of winning or an official score.

## Final cleanup and fixes

- Moved detailed evaluation statistics and research limits from the workspace to `/evaluation`; preserved access to every raw observation, including failures. Added a first-screen path to the recorded real audit, separate from the illustrative example.
- Fixed clearing the tab: drafts, repository, requirements, source hints, recovery checkpoints, optional token and assessment state are cleared together. Empty fields remain empty after reload. Tokens are never persisted.
- Validate restored report shape and cached field types. Strengthened report-import validation for fields consumed by Claims, Requirements and Evidence, rejecting malformed source identities, dates, associations, hints and token counts.
- PR/commit mode clears the default target so the imported URL can select its actual repository. Recheck selects the report's repository and revision even when another draft or source URL has been entered. Checking a requirement retains the report's repository and pinned commit.
- Removed three tracked runtime logs and eight unused legacy component/helper files. Historical seed records and original planning documents remain preserved; the legacy report renderer remains because existing report links still use it. Logs are excluded from future commits and deploy uploads.
- Removed unnecessary standalone output configuration so documented `npm run build` and `npm start` use the supported standard server path.
- A real message audit exposed a missed supplied license prohibition. A narrow parsed-manifest check now flags that explicit conflict only after full source support, excludes ambiguous/negated/conditional/example text and compares complete license identifiers. This is a review-constraint check, not legal license analysis. Failed actual observations remain recorded.
- Private-source options disclose that matched excerpts are sent to Google Gemini. Detailed evidence is deliberately kept accessible on the evaluation page without occupying the workspace's first screen.
- Shared-report fragment changes now trigger fresh verification, clear the earlier result and reject obsolete asynchronous completions. A browser regression covers valid report switching, invalid fragments and Back navigation; the actual pre-fix public failure remains in the raw observations.
- Patched Next.js and @next/env to 16.3.8 and updated compatible runtime transitive dependencies. The locked production dependency scan reports zero known advisories. The full tree retains seven high and two moderate findings in the Tailwind 3 / Next ESLint glob-processing build-tool stack; current compatible versions do not resolve those reported ranges. These are development tooling findings, not a claim that public requests exploit them. No blanket security certification is made. Exact package names and registry advisory links are retained in `benchmark/v3/dependency-audit.json`.

## Remaining evidence limits

No independent testers exist yet, as confirmed by the owner. Independent comprehension, a real user's corrected decision, time saved and practical adoption remain unmeasured. The frozen six-repository evaluation is builder-labeled and uses explicit source hints; it is not blinded, independent or a measure of broad repository discovery. The raw-model baseline outperformed the validated pipeline on the retained 32/33 live run. A later replay recovered the lost case but made no new model calls. No competitive advantage is established by that replay.

Actual provider timeouts/capacity failures remain recorded. A successful fresh request does not establish sustained availability. Source inspection, quotation checks and conservative heuristics cannot establish runtime semantics or defeat every adversarial input. These limits are not solved by adding website features or changing a numerical rating.

## Final validation and delivery

The public website runs application revision `7c6c501a7a49b13952a438eb4de79694f9736070`, verifier 2.2.0. [CI 39119560968](https://github.com/kathir-iTech/Vibe_Check/actions/runs/39119560968) passed all 37 production tests, 14 controlled browser workflows, 15 source-bound manufactured cases, lint, TypeScript and the production build.

Authenticated staging and anonymous public readback passed actual GitHub retrieval, report issuance, independent Node Ed25519 verification and sharing, with zero model calls. Public Chrome verified historical and newly issued reports, the fresh actual local message report, fragment switching, the supplied requirement conflict and the retained 32/33 counter, with zero page errors or mobile overflow. `benchmark/v3/final-delivery.json` preserves the observations. The separate fresh actual model observation matched three selected expectations and independently verified its export; earlier provider failures and the missed conflict remain recorded. This does not measure independent users or general accuracy.

Subsequent documentation/evidence commits do not change application source. BUILD_STATUS.md records delivery details and unresolved evidence. Temporary package caches remain local, ignored and excluded from deployment after automated review blocked recursive cleanup; tracked source cleanup is complete.

## Strict product-only estimate

| Criterion | Estimate / 100 | Reason and limit |
| --- | ---: | --- |
| Design | 92 | Compact first workflow, visible actual proof, accessible responsive controls, recovery and inspectable evidence. Independent first-use comprehension remains unmeasured. |
| Potential Impact | 82 | A concrete review problem and actionable evidence boundaries. No independent corrected decision, adoption or measured time savings yet. |
| Innovation / Idea | 84 | Commit-bound source/requirement review, conservative evidence ceilings, signed complete reports and rechecks form a coherent product. Competitive superiority and broad semantic coverage are not demonstrated. |
| Normalized total | **86** | Equal weighting of the three retained official criteria. Presentation, video and submission quality are entirely excluded. |

This estimate is subjective and not an official jury score or winning probability. A 97+ assessment is not supported by the present evidence. Adding controls, rewriting website copy or passing more builder-selected cases cannot substitute for independent impact observations, blinded evaluation on previously unseen repositories, or demonstrated advantage over simpler tools. A real model audit matching three selected expectations does not change the retained six-repository live evaluation from 32/33 to a new accuracy claim.
