#!/usr/bin/env node
// Benchmark runner for VibeCheck claims verification.
// Posts claims in batches to /api/check-evidence and /api/check-spec-drift,
// runs 3 repeats per batch, collects results, writes benchmark/results.json.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { summarize } from "./summarize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CLAIMS_PATH = resolve(REPO_ROOT, "benchmark/claims.json");
const RESULTS_PATH = resolve(REPO_ROOT, "benchmark/results.json");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BATCH_SIZE = 12;
const REPEATS = 3;
const MAX_GEMINI_CALLS = 6;
const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || "gemini-3-flash-preview";

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} text
 * @property {"true"|"false"|"unverifiable"} label
 * @property {string} groundTruth
 * @property {string} verifiedWith
 */

/**
 * @typedef {Object} BenchmarkClaims
 * @property {string} pinnedCommitSHA
 * @property {string} generatedAt
 * @property {Claim[]} claims
 */

/**
 * @typedef {Object} EvidenceResponse
 * @property {Record<string, any>} evidence
 * @property {string} [error]
 * @property {any} [timings]
 */

/**
 * @typedef {Object} DriftResponse
 * @property {any[]} drift
 * @property {string|null} model
 * @property {boolean} modelFallback
 * @property {any} [usage]
 * @property {any} [timings]
 * @property {string} [error]
 */

/**
 * @typedef {Object} RunResult
 * @property {string} claimId
 * @property {string} verdict
 * @property {string} reason
 * @property {string} specReference
 * @property {string|null} model
 * @property {boolean} modelFallback
 * @property {{evidence:number, drift:number, total:number}} timings
 * @property {any} [usage]
 */

/**
 * @typedef {Object} BenchmarkResults
 * @property {string} headSha
 * @property {RunResult[][]} runs
 * @property {{
 *   falseClaimsReturnedTrue: {count:number, total:number, details:string[]},
 *   unverifiableClaimsReturnedTrue: {count:number, total:number, details:string[]},
 *   trueClaimsReturnedTrue: {count:number, total:number, details:string[]},
 *   verdictChangedBetweenRuns: {count:number, total:number, details:string[]},
 *   medianLatencyMs: number,
 *   p95LatencyMs: number
 * }} summary
 * @property {number[]} fallbackRuns
 * @property {string} createdAt
 */

async function fetchWithRetry(url, init, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status === 503) {
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          console.log(`[benchmark] Got ${res.status}, backing off ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.log(`[benchmark] Fetch error, retrying in ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

async function postEvidence(claims) {
  const res = await fetchWithRetry(`${BASE_URL}/api/check-evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl: "https://github.com/kathir-iTech/Vibe_Check", claims })
  });
  return res.json();
}

async function postDrift(claims, evidence) {
  const res = await fetchWithRetry(`${BASE_URL}/api/check-spec-drift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl: "https://github.com/kathir-iTech/Vibe_Check", claims, evidence })
  });
  return res.json();
}

function loadPartialResults() {
  if (existsSync(RESULTS_PATH)) {
    try {
      const content = readFileSync(RESULTS_PATH, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

function saveResults(results) {
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), "utf8");
  console.log(`[benchmark] Saved partial results to ${RESULTS_PATH}`);
}

function getHeadSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`[benchmark] Starting benchmark against ${BASE_URL}`);

  // Check server reachability
  try {
    const healthRes = await fetch(`${BASE_URL}/api/self-audit`, { method: "POST", body: "{}" });
    if (!healthRes.ok && healthRes.status !== 400) throw new Error(`Status ${healthRes.status}`);
    console.log("[benchmark] Server reachable");
  } catch (err) {
    console.error(`[benchmark] ERROR: Cannot reach ${BASE_URL}: ${err.message}`);
    console.error("[benchmark] Make sure dev server is running with .env.local");
    process.exit(1);
  }

  /** @type {BenchmarkClaims} */
  const claimsData = JSON.parse(readFileSync(CLAIMS_PATH, "utf8"));
  const allClaims = claimsData.claims;
  const headSha = getHeadSha();
  console.log(`[benchmark] HEAD SHA: ${headSha}`);
  console.log(`[benchmark] Loaded ${allClaims.length} claims from ${CLAIMS_PATH}`);

  // Load partial results if resuming
  const partial = loadPartialResults();
  const runs = partial?.runs || [];
  const completedClaimIds = new Set(runs.flat().map(r => r.claimId));
  const fallbackRuns = partial?.fallbackRuns || [];
  let geminiCallCount = 0;
  let primaryModelMismatch = false;

  // Process claims in batches
  for (let batchStart = 0; batchStart < allClaims.length; batchStart += BATCH_SIZE) {
    const batch = allClaims.slice(batchStart, batchStart + BATCH_SIZE);
    console.log(`\n[benchmark] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batch.map(c => c.id).join(", ")}`);

    for (let repeat = 0; repeat < REPEATS; repeat++) {
      const runIndex = runs.length;
      console.log(`[benchmark]   Repeat ${repeat + 1}/${REPEATS} (run #${runIndex + 1})`);

      // Check if we've already done this run (resume support)
      const runKey = `${batchStart}-${repeat}`;
      if (completedClaimIds.has(runKey)) {
        console.log(`[benchmark]   Skipping already-completed run`);
        continue;
      }

      // Check Gemini call budget
      if (geminiCallCount >= MAX_GEMINI_CALLS) {
        console.log(`[benchmark]   Reached max Gemini calls (${MAX_GEMINI_CALLS}), stopping`);
        break;
      }

      try {
        // Step 1: Get evidence
        const evidenceStart = performance.now();
        const evidenceRes = await postEvidence(batch);
        const evidenceMs = Math.round(performance.now() - evidenceStart);

        if (evidenceRes.error) {
          throw new Error(`check-evidence error: ${evidenceRes.error}`);
        }

        // Step 2: Get drift/spec verification
        const driftStart = performance.now();
        const driftRes = await postDrift(batch, evidenceRes.evidence || {});
        const driftMs = Math.round(performance.now() - driftStart);

        if (driftRes.error) {
          throw new Error(`check-spec-drift error: ${driftRes.error}`);
        }

        const totalMs = evidenceMs + driftMs;
        geminiCallCount++;

        // Track fallback
        if (driftRes.modelFallback) {
          fallbackRuns.push(runIndex);
          console.log(`[benchmark]     Fallback model used: ${driftRes.model}`);
        }
        // Check model primary override
        if (driftRes.model && driftRes.model !== PRIMARY_MODEL) {
          console.error(`[benchmark]     Model mismatch: expected ${PRIMARY_MODEL}, got ${driftRes.model}`);
          primaryModelMismatch = true;
        }

        // Build run results
        const runResults = [];
        for (const claim of batch) {
          const drift = driftRes.drift.find(d => d.claimId === claim.id);
          const verdict = drift?.verdict || "UNVERIFIED";
          const reason = drift?.reason || "No assessment produced";
          const specReference = drift?.specReference || "";

          runResults.push({
            claimId: claim.id,
            verdict,
            reason,
            specReference,
            model: driftRes.model,
            modelFallback: driftRes.modelFallback,
            timings: { evidence: evidenceMs, drift: driftMs, total: totalMs },
            usage: driftRes.usage
          });
        }

        runs.push(runResults);
        saveResults({ headSha, runs, fallbackRuns, summary: {}, createdAt: new Date().toISOString() });

        console.log(`[benchmark]     Completed in ${totalMs}ms (evidence: ${evidenceMs}ms, drift: ${driftMs}ms)`);
        console.log(`[benchmark]     Verdicts: ${runResults.map(r => `${r.claimId}=${r.verdict}`).join(", ")}`);

      } catch (err) {
        console.error(`[benchmark]   Run failed: ${err.message}`);
        // Save partial and continue
        saveResults({ headSha, runs, fallbackRuns, summary: {}, createdAt: new Date().toISOString() });
      }
    }
  }

  // Compute summary statistics using pure function
  console.log("\n[benchmark] Computing summary...");
  const results = JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  const summary = summarize(results.runs, allClaims, REPEATS);

  // Overwrite the summary in the results file
  results.summary = summary;
  saveResults(results);

  // Exit non-zero if any run used a different model than primary
  if (primaryModelMismatch) {
    console.error("[benchmark] FATAL: Some runs used a different model than GEMINI_PRIMARY_MODEL");
    process.exit(1);
  }

  // Print summary

  // Print summary
  console.log("\n=== BENCHMARK SUMMARY ===");
  console.log(`False claims returned TRUE: ${summary.falseClaimsReturnedTrue.count} / ${summary.falseClaimsReturnedTrue.total} runs`);
  for (const d of summary.falseClaimsReturnedTrue.details) console.log(`  ${d}`);

  console.log(`\nUnverifiable claims returned TRUE: ${summary.unverifiableClaimsReturnedTrue.count} / ${summary.unverifiableClaimsReturnedTrue.total} runs`);
  for (const d of summary.unverifiableClaimsReturnedTrue.details) console.log(`  ${d}`);

  console.log(`\nTrue claims returned TRUE: ${summary.trueClaimsReturnedTrue.count} / ${summary.trueClaimsReturnedTrue.total} runs`);
  for (const d of summary.trueClaimsReturnedTrue.details) console.log(`  ${d}`);

  console.log(`\nClaims whose verdict changed between runs: ${summary.verdictChangedBetweenRuns.count} / ${summary.verdictChangedBetweenRuns.total}`);
  for (const d of summary.verdictChangedBetweenRuns.details) console.log(`  ${d}`);

  console.log(`\nMedian latency: ${summary.medianLatencyMs}ms`);
  console.log(`P95 latency: ${summary.p95LatencyMs}ms`);

  if (fallbackRuns.length > 0) {
    console.log(`\nFallback model used in runs: ${fallbackRuns.join(", ")}`);
  }

  console.log(`\nResults written to ${RESULTS_PATH}`);
}

main().catch(err => {
  console.error("[benchmark] Fatal error:", err);
  process.exit(1);
});