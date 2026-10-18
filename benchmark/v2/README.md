# Current verification evidence

These records separate deterministic guard checks, actual provider requests and development failures. They do not establish population accuracy or an independent user study.

## Manufactured comparison

`adversarial.json` records 15 deliberately constructed cases using the actual preserved legacy functions and current production functions/routes. All 15 current outcomes match their expected result. Of 13 unsafe cases, the legacy implementation accepted 11 and the current implementation accepts zero. This measures the selected failure modes, not arbitrary semantic correctness.

Reproduce without provider credentials:

```sh
node scripts/evaluate-verifier.mjs
```

The script checks normalized source hashes as well as outcomes. An intentional source change requires reviewing and recording a new result with `--write`. The legacy source bytes are in `benchmark/history/verification-source.json`.

## Actual public-source requests

`live-evaluation.json` records two actual API requests at verifier revision `5121ca1e3443a6078453c80c8ed621b49d6e1434`. Each request supplies four claims about a pinned public repository: licensing, a manifest setting, an absent dependency and an unsupported tests-passed claim. Expected labels are derived from each pinned package manifest before the request. Eight of eight outcomes matched. Complete signed reports are in `live/`; reported source coverage, models, usage, timing and warnings remain available there.

The subjects are Express and Chalk, not additional projects modified by this work. Requests only read their public source. The later provider-timeout fallback change is evaluated separately by production-function tests; these existing requests are not relabeled as having used it.

`scripts/live-evaluation.mjs` intentionally consumes provider capacity and writes a fresh observation. Preserve existing records before running it again. Its default target is `http://localhost:3018`; `BASE_URL` overrides the target.

## Preserved failures

`development-observations.json` contains two earlier actual development observations. The first exposed a real dependency-retrieval false negative. The second followed its correction. Verifier source was changing during these requests, so neither belongs in the frozen-version denominator above.

A separate initial live browser attempt failed when the provider returned HTTP 504. The test's asynchronous response observer also failed during teardown. These failures are recorded, rather than counted as successful audits. Subsequent browser verification is reported in the build/delivery record.

## Interpretation

“Source supported” means quoted static evidence survived the configured guards. The system does not execute the target repository, prove security, or certify test/deployment claims from source alone. Requirement associations are review aids. Signed reports establish issuance and integrity, not truth. Selected cases, builder-supplied labels, retrieval limits and correlated model behavior limit generalization.
