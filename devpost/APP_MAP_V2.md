# Current implementation map

Updated 18 October 2026. `app-map.html` preserves the earlier learning tour; this map describes the revised implementation.

1. **Workspace → audit.** `src/components/AuditWorkspace.tsx` collects message/claims/PR input and consumes actual progress from `POST /api/audit`. `AuditResults.tsx` shows citations, explicit requirement omissions, exact-text comparison and evidence provenance. Tokens are request-only; examples are illustrative.
2. **Audit → one Git SHA.** `src/lib/audit-service.ts` orchestrates the audit. `src/lib/github.ts` resolves the target to a full SHA. The evidence route and planning-document reads use that same revision. Coverage reports the retrieval limits. Follow `resolveSnapshot()` and the production-handler cases in `tests/snapshot.test.mjs`.
3. **Model proposal → guarded assessment.** `src/lib/gemini.ts` extracts claims and proposes quotations. `verification-guards.mjs` checks exact quotation semantics, comment context, restatements and disabled settings. `/api/check-spec-drift` applies evidence obligations: source alone cannot establish that tests passed or a deployment ran. Follow `validateAssessments()` → `findLineNumber()` → the claim verdict. These are defensive heuristics, not proofs of semantics.
4. **Assessment → complete receipt.** `report-format.mjs` defines bounded canonical report data. `report-crypto.mjs` signs the envelope with Ed25519. `/api/generate-report` accepts an existing server receipt, not arbitrary client verdicts. `/report/view` verifies fragment data before display. A valid signature authenticates issuance and integrity, not the conclusion.

To inspect this boundary, export a signed report, obtain the public key separately from `/api/report-key`, then run `node scripts/verify-report.mjs audit.json trusted-key.json`. Change a quotation and verify again; integrity checking should fail.

`npm run verify` covers lint, preserved historical checks, production-function/route tests and the production build. Browser fixtures and optional actual-provider browser checks are separate. `benchmark/v2/` contains manufactured comparisons, selected actual public-source observations and development failures. The completed earlier learning activity remains recorded in the checklist; this update does not invent a new learner exercise.

`src/app/proof/page.tsx` discloses a recorded actual public-source observation, its date and the builder-supplied test requirement. Its link opens the original complete signed report at the public issuer, which verifies the signature before displaying evidence. This path consumes no new model capacity and does not present recorded output as a fresh audit.
