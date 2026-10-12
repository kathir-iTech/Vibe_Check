/**
 * Pure function that computes benchmark summary from runs array.
 * No I/O, no env vars, no side effects.
 *
 * Can be imported via: import { summarize } from "./summarize.mjs"
 *
 * @param {Array<Array<Object>>} runs - The runs array from results.json,
 *   where each run is an array of claim result objects with claimId and verdict fields.
 * @param {Array<Object>} allClaims - The full list of claims from claims.json,
 *   each with { id, text, label }.
 * @param {number} [REPEATS=3] - Number of repeat runs.
 * @returns {Object} The computed summary object.
 */
export function summarize({ runs, allClaims, REPEATS = 3 }) {
  const falseClaims = allClaims.filter(c => c.label === "false");
  const trueClaims = allClaims.filter(c => c.label === "true");
  const unverifiableClaims = allClaims.filter(c => c.label === "unverifiable");

  let falseReturnedTrue = 0;
  let falseDetails = [];
  let unverifiableReturnedTrue = 0;
  let unverifiableDetails = [];
  let trueReturnedTrue = 0;
  let trueDetails = [];
  let verdictChanged = 0;
  let changedDetails = [];
  const allLatencies = [];

  for (const claim of allClaims) {
    const claimRuns = runs.filter(r => r.some(rr => rr.claimId === claim.id));
    const verdicts = claimRuns.flat().map(r => r.verdict);
    const trueCount = verdicts.filter(v => v === "TRUE").length;

    // Track latencies
    for (const run of claimRuns) {
      for (const r of run) {
        if (r.claimId === claim.id) {
          allLatencies.push(r.timings?.total || 0);
        }
      }
    }

    // Check if verdict changed between runs
    const uniqueVerdicts = [...new Set(verdicts)];
    if (uniqueVerdicts.length > 1) {
      verdictChanged++;
      changedDetails.push(`${claim.id}: ${uniqueVerdicts.join(" → ")} (label: ${claim.label})`);
    }

    if (claim.label === "false" && trueCount > 0) {
      falseReturnedTrue++;
      const runWithTrue = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "TRUE"));
      const citedLine = runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A";
      falseDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
    }

    if (claim.label === "unverifiable" && trueCount > 0) {
      unverifiableReturnedTrue++;
      const runWithTrue = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "TRUE"));
      const citedLine = runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A";
      unverifiableDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
    }

    if (claim.label === "true" && trueCount > 0) {
      trueReturnedTrue++;
      const runWithTrue = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "TRUE"));
      const citedLine = runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A";
      trueDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
    }
  }

  const totalFalse = falseClaims.length * REPEATS;
  const totalUnverifiable = unverifiableClaims.length * REPEATS;
  const totalTrue = trueClaims.length * REPEATS;
  const totalChecks = allClaims.length;

  return {
    falseClaimsReturnedTrue: { count: falseReturnedTrue, total: totalFalse, details: falseDetails },
    unverifiableClaimsReturnedTrue: { count: unverifiableReturnedTrue, total: totalUnverifiable, details: unverifiableDetails },
    trueClaimsReturnedTrue: { count: trueReturnedTrue, total: totalTrue, details: trueDetails },
    verdictChangedBetweenRuns: { count: verdictChanged, total: totalChecks, details: changedDetails },
    medianLatencyMs: allLatencies.length > 0
      ? Math.round(allLatencies.sort((a, b) => a - b)[Math.floor(allLatencies.length / 2)])
      : 0,
    p95LatencyMs: allLatencies.length > 0
      ? Math.round(allLatencies.sort((a, b) => a - b)[Math.ceil(0.95 * allLatencies.length) - 1])
      : 0
  };
}