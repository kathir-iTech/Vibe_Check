#!/usr/bin/env node
// Check that the committed benchmark summary matches the raw runs data.
// Exits non-zero if the summary differs from recomputed values.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { summarize } from "./summarize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const RESULTS_PATH = resolve(REPO_ROOT, "benchmark/results.json");
const CLAIMS_PATH = resolve(REPO_ROOT, "benchmark/claims.json");

const REPEATS = 3;

function main() {
  let hasError = false;

  const results = JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  const claimsData = JSON.parse(readFileSync(CLAIMS_PATH, "utf8"));
  const allClaims = claimsData.claims;

  const runs = results.runs || [];
  const totalRunsFlat = runs.flat().length;
  const totalClaims = allClaims.length;
  const expectedEntries = totalClaims * REPEATS;

  console.log(`[check-benchmark] Total flat run entries: ${totalRunsFlat}`);
  console.log(`[check-benchmark] Claims in claims.json: ${totalClaims}`);
  console.log(`[check-benchmark] Expected entries per repeat cycle: ${expectedEntries}`);

  // Recompute summary from raw runs (works with partial data)
  let computed;
  try {
    computed = summarize({ runs, allClaims, REPEATS });
    console.log("[check-benchmark] OK: Summary recomputed from raw runs");
  } catch (e) {
    console.error(`[check-benchmark] FAIL: Could not recompute summary: ${e.message}`);
    hasError = true;
  }

  if (computed) {
    // Compare with committed summary
    const committedSummary = results.summary;

    const checks = [
      { name: "falseClaimsReturnedTrue", key: "count", totalKey: "total" },
      { name: "unverifiableClaimsReturnedTrue", key: "count", totalKey: "total" },
      { name: "trueClaimsReturnedTrue", key: "count", totalKey: "total" },
      { name: "verdictChangedBetweenRuns", key: "count", totalKey: "total" },
      { name: "medianLatencyMs", key: "a", totalKey: "b" },
      { name: "p95LatencyMs", key: "a", totalKey: "b" },
    ];

    for (const { name, key, totalKey } of checks) {
      const a = computed[key];
      const b = committedSummary ? committedSummary[key] : null;

      if (b === null) {
        console.log(`[check-benchmark]  ${name}: not available in committed summary`);
        continue;
      }

      const match = a === b;
      console.log(`[check-benchmark]  ${name}: ${a} vs ${b} ${match ? "OK" : "MISMATCH"}`);
      if (!match) {
        hasError = true;
        console.error(`[check-benchmark] FAIL: ${name} mismatch`);
      }
    }

    // Details-level check for trueClaimsReturnedTrue
    if (computed.trueClaimsReturnedTrue && committedSummary?.trueClaimsReturnedTrue) {
      const detailsMatch = JSON.stringify(computed.trueClaimsReturnedTrue.details) ===
        JSON.stringify(committedSummary.trueClaimsReturnedTrue.details);
      console.log(`[check-benchmark]  trueClaimsReturnedTrue details ${detailsMatch ? "OK" : "MISMATCH"}`);
      if (!detailsMatch) {
        hasError = true;
        console.error("[check-benchmark] FAIL: trueClaimsReturnedTrue details differ");
        const committedDetails = new Set(committedSummary.trueClaimsReturnedTrue.details);
        const computedDetails = new Set(computed.trueClaimsReturnedTrue.details);
        for (const d of computedDetails) {
          if (!committedDetails.has(d)) {
            console.error(`[check-benchmark]    Computed but not committed: ${d}`);
          }
        }
        for (const d of committedDetails) {
          if (!computedDetails.has(d)) {
            console.error(`[check-benchmark]    Committed but not computed: ${d}`);
          }
        }
      }
    }
  }

  // Coverage check - report but don't necessarily fail for partial data
  if (totalRunsFlat < expectedEntries) {
    console.log(`[check-benchmark] Coverage: ${totalRunsFlat}/${expectedEntries} entries (${totalClaims} claims x ${REPEATS} repeats)`);
    console.log("[check-benchmark] FAIL: Full benchmark requires all ${totalClaims} claims x ${REPEATS} repeats");
    hasError = true;
  }

  if (hasError) {
    console.error("[check-benchmark] FAIL: Summary does not match raw runs data");
    process.exit(1);
  } else {
    console.log("[check-benchmark] OK: All checks passed - summary matches raw runs data");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[check-benchmark] Fatal error:", err);
  process.exit(1);
});