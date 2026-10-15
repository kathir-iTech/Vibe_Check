/**
 * Pure function that computes benchmark summary from runs array.
 * No I/O, no env vars, no side effects.
 *
 * Can be imported via: import { summarize } from "./summarize.mjs"
 *
 * @param {Object} params
 * @param {Array<Array<Object>>} params.runs - The runs array from results.json,
 *   where each run is an array of claim result objects with claimId and verdict fields.
 * @param {Array<Object>} params.allClaims - The full list of claims from claims.json,
 *   each with { id, text, label }.
 * @param {number} [params.REPEATS=3] - Number of repeat runs.
 * @returns {Object} The computed summary object.
 */
export function summarize({ runs, allClaims, REPEATS = 3 }) {
  if (!Array.isArray(runs) || !Array.isArray(allClaims)) {
    throw new Error("[summarize] runs and allClaims must be arrays");
  }

  const falseClaims = allClaims.filter((c) => c.label === "false");
  const trueClaims = allClaims.filter((c) => c.label === "true");
  const unverifiableClaims = allClaims.filter((c) => c.label === "unverifiable");

  let falseReturnedTrueCount = 0;
  const falseDetails = [];
  let unverifiableReturnedTrueCount = 0;
  const unverifiableDetails = [];
  let trueReturnedTrueCount = 0;
  let trueSpectrumDriftCount = 0;
  const trueDetails = [];
  const trueDetailsSdrift = [];
  let verdictChanged = 0;
  const changedDetails = [];
  const allLatencies = [];

  const flatEntries = runs.flat().filter(Boolean);

  // Collect per-batch-run latencies (one total timing per batch execution)
  for (const run of runs) {
    if (Array.isArray(run) && run.length > 0 && typeof run[0]?.timings?.total === "number") {
      allLatencies.push(run[0].timings.total);
    }
  }

  for (const claim of allClaims) {
    // Per-claim unit: ONLY entries where claimId === claim.id
    const claimEntries = flatEntries.filter((rr) => rr.claimId === claim.id);

    if (claimEntries.length < REPEATS) {
      throw new Error(
        `[summarize] Claim ${claim.id} has ${claimEntries.length}/${REPEATS} runs — missing data`
      );
    }

    const verdicts = claimEntries.slice(0, REPEATS).map((r) => r.verdict);

    const uniqueVerdicts = [...new Set(verdicts)];
    if (uniqueVerdicts.length > 1) {
      verdictChanged++;
      changedDetails.push(`${claim.id}: ${verdicts.join(" → ")} (label: ${claim.label})`);
    }

    if (claim.label === "false") {
      const trueRuns = claimEntries.slice(0, REPEATS).filter((r) => r.verdict === "TRUE");
      falseReturnedTrueCount += trueRuns.length;
      if (trueRuns.length > 0) {
        const citedLine = trueRuns[0]?.specReference || "N/A";
        falseDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
      }
    }

    if (claim.label === "unverifiable") {
      const trueRuns = claimEntries.slice(0, REPEATS).filter((r) => r.verdict === "TRUE");
      unverifiableReturnedTrueCount += trueRuns.length;
      if (trueRuns.length > 0) {
        const citedLine = trueRuns[0]?.specReference || "N/A";
        unverifiableDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
      }
    }

    if (claim.label === "true") {
      const trueRuns = claimEntries.slice(0, REPEATS).filter((r) => r.verdict === "TRUE");
      const sdriftRuns = claimEntries.slice(0, REPEATS).filter((r) => r.verdict === "SPEC-DRIFT");
      trueReturnedTrueCount += trueRuns.length;
      trueSpectrumDriftCount += sdriftRuns.length;

      if (trueRuns.length > 0) {
        const citedLine = trueRuns[0]?.specReference || "N/A";
        trueDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
      }

      if (sdriftRuns.length > 0) {
        const citedLine = sdriftRuns[0]?.specReference || "N/A";
        trueDetailsSdrift.push(`${claim.id}: "${claim.text}" — cited: ${citedLine} — SPEC-DRIFT`);
      }
    }
  }

  const totalFalse = falseClaims.length * REPEATS;
  const totalUnverifiable = unverifiableClaims.length * REPEATS;
  const totalTrue = trueClaims.length * REPEATS;
  const totalChecks = allClaims.length;

  const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
  const medianLatencyMs =
    sortedLatencies.length > 0
      ? Math.round(sortedLatencies[Math.floor(sortedLatencies.length / 2)])
      : 0;
  const p95LatencyMs =
    sortedLatencies.length > 0
      ? Math.round(sortedLatencies[Math.max(0, Math.ceil(0.95 * sortedLatencies.length) - 1)])
      : 0;

  return {
    falseClaimsReturnedTrue: {
      count: falseReturnedTrueCount,
      total: totalFalse,
      details: falseDetails,
    },
    unverifiableClaimsReturnedTrue: {
      count: unverifiableReturnedTrueCount,
      total: totalUnverifiable,
      details: unverifiableDetails,
    },
    trueClaimsReturnedTrue: {
      count: trueReturnedTrueCount,
      total: totalTrue,
      details: trueDetails,
    },
    trueClaimsReturnedSPEC_DRIFT: {
      count: trueSpectrumDriftCount,
      total: totalTrue,
      details: trueDetailsSdrift,
    },
    verdictChangedBetweenRuns: {
      count: verdictChanged,
      total: totalChecks,
      details: changedDetails,
    },
    medianLatencyMs,
    p95LatencyMs,
  };
}