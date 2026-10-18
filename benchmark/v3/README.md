# Product assessment observations

This directory preserves actual builder-run observations and a separately labeled validator replay. No independent-user study, competing-product superiority or population accuracy is established.

## Frozen subjects and labels

`plan.json` records 33 builder-authored expectations on pinned Express, Chalk, Flask, Requests, Hono and Zod revisions before the provider runs. The cases include source presence, manifest declarations, execution/deployment boundaries, universal overclaims and unsupported named functions. Explicit paths are supplied; these runs do not evaluate automatic file discovery. Labels and cases are selected, not blinded or independent.

| Record | Actual provider requests | Assessed claims | Expected outcomes | Interpretation |
| --- | --- | --- | --- | --- |
| `first-observation.json` | 4/6 completed | 21/33 | 19/33 planned | Two requests failed; missed support and availability failures remain in the denominator |
| `after-reliability-window-fix.json` | 6/6 completed | 33/33 | 32/33 | One primary failure recovered through fallback; one structural declaration was incorrectly rejected |
| `after-reliability-window-fix-validator-replay.json` | No new model calls | 33 recorded answers | 33/33 replay expectations | Current validator, previously recorded answers and newly retrieved pinned source; not a new live accuracy result |
| `live-browser-failure.json` | Fresh browser attempt failed | No complete report | Not scored | UI reported provider capacity; claims were recoverable; signature verification did not occur |

The second run's raw-model ablation matched 33/33 while the validated pipeline matched 32/33. This is a useful counterexample to claiming that deterministic gates always improve answers. The structural presence false negative was subsequently fixed and tested against both real syntax and embedded prose. The original run remains 32/33.

Among the 24 non-positive cases assessed in the second run, neither the raw-model baseline nor the pipeline accepted unsupported full support. This finite result does not establish general false-positive rates. The baseline uses the same model response before deterministic validation; it is not a full alternative review product.

`summary.json` recomputes descriptive completion, recovery, support and latency counts from the two recorded runs. Timing differences reflect provider variation as well as source changes and do not establish a causal speed improvement.

## Reproduce

Use Node 24, installed project dependencies and ignored local provider/GitHub configuration as described in the repository README. Do not print or commit credentials.

```sh
node scripts/summarize-product-evaluation.mjs first-observation after-reliability-window-fix
node scripts/run-product-evaluation.mjs a-new-run-name
node scripts/replay-product-evaluation.mjs a-new-run-name
```

New run names are required; scripts refuse to overwrite existing records. A live run consumes actual provider capacity. A replay makes GitHub reads but no model calls. `prepare-product-evaluation.mjs` refuses to replace the frozen plan. Historical raw answers, failures, subject revisions and source hashes must remain distinguishable from later observations.
