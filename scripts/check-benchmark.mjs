#!/usr/bin/env node
// Check that the committed benchmark summary matches the raw runs data.
// Exits non-zero if the summary differs from recomputed values or if coverage < 72/72.

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

  let computed;
  try {
    computed = summarize({ runs, allClaims, REPEATS });
    console.log("[check-benchmark] OK: Summary recomputed from raw runs");
  } catch (e) {
    console.error(`[check-benchmark] FAIL: Could not recompute summary: ${e.message}`);
    hasError = true;
  }

  if (computed) {
    const committedSummary = results.summary;
    if (!committedSummary || typeof committedSummary !== "object") {
      console.error("[check-benchmark] FAIL: Missing committed summary object in results.json");
      hasError = true;
    } else {
      const bucketNames = [
        "falseClaimsReturnedTrue",
        "unverifiableClaimsReturnedTrue",
        "trueClaimsReturnedTrue",
        "trueClaimsReturnedSPEC_DRIFT",
        "verdictChangedBetweenRuns",
      ];

      for (const name of bucketNames) {
        const compBucket = computed[name];
        const commBucket = committedSummary[name];

        if (
          !compBucket ||
          !commBucket ||
          typeof compBucket.count !== "number" ||
          typeof commBucket.count !== "number" ||
          typeof compBucket.total !== "number" ||
          typeof commBucket.total !== "number"
        ) {
          console.error(`[check-benchmark] FAIL: ${name} has undefined or non-numeric count/total`);
          hasError = true;
          continue;
        }

        const countMatch = compBucket.count === commBucket.count;
        const totalMatch = compBucket.total === commBucket.total;
        console.log(
          `[check-benchmark]  ${name}: ${compBucket.count}/${compBucket.total} vs ${commBucket.count}/${commBucket.total} ${
            countMatch && totalMatch ? "OK" : "MISMATCH"
          }`
        );
        if (!countMatch || !totalMatch) {
          hasError = true;
          console.error(`[check-benchmark] FAIL: ${name} mismatch`);
        }
      }

      for (const scalarName of ["medianLatencyMs", "p95LatencyMs"]) {
        const a = computed[scalarName];
        const b = committedSummary[scalarName];
        if (typeof a !== "number" || typeof b !== "number") {
          console.error(`[check-benchmark] FAIL: ${scalarName} has undefined value (${a} vs ${b})`);
          hasError = true;
          continue;
        }
        const match = a === b;
        console.log(`[check-benchmark]  ${scalarName}: ${a} vs ${b} ${match ? "OK" : "MISMATCH"}`);
        if (!match) {
          hasError = true;
          console.error(`[check-benchmark] FAIL: ${scalarName} mismatch`);
        }
      }

      if (computed.trueClaimsReturnedTrue && committedSummary.trueClaimsReturnedTrue) {
        const detailsMatch =
          JSON.stringify(computed.trueClaimsReturnedTrue.details) ===
          JSON.stringify(committedSummary.trueClaimsReturnedTrue.details);
        console.log(
          `[check-benchmark]  trueClaimsReturnedTrue details ${detailsMatch ? "OK" : "MISMATCH"}`
        );
        if (!detailsMatch) {
          hasError = true;
          console.error("[check-benchmark] FAIL: trueClaimsReturnedTrue details differ");
        }
      }

      if (computed.trueClaimsReturnedSPEC_DRIFT && committedSummary.trueClaimsReturnedSPEC_DRIFT) {
        const sdriftDetailsMatch =
          JSON.stringify(computed.trueClaimsReturnedSPEC_DRIFT.details) ===
          JSON.stringify(committedSummary.trueClaimsReturnedSPEC_DRIFT.details);
        console.log(
          `[check-benchmark]  trueClaimsReturnedSPEC_DRIFT details ${
            sdriftDetailsMatch ? "OK" : "MISMATCH"
          }`
        );
        if (!sdriftDetailsMatch) {
          hasError = true;
          console.error("[check-benchmark] FAIL: trueClaimsReturnedSPEC_DRIFT details differ");
        }
      }
    }
  }

  if (totalRunsFlat < expectedEntries) {
    console.log(
      `[check-benchmark] Coverage: ${totalRunsFlat}/${expectedEntries} entries (${totalClaims} claims x ${REPEATS} repeats)`
    );
    console.log(
      `[check-benchmark] FAIL: Full benchmark requires all ${totalClaims} claims x ${REPEATS} repeats`
    );
    hasError = true;
  }

  if (hasError) {
    console.error("[check-benchmark] FAIL: Summary does not match raw runs data");
    process.exit(1);
  } else {
    console.log("[check-benchmark] OK: All checks passed - summary matches raw runs data (72/72)");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[check-benchmark] Fatal error:", err);
  process.exit(1);
});