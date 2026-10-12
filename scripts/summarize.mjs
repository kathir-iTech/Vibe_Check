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
 *
 * Per-claim unit: only entries where claimId === claim.id (no flat across claims).
 * For each label, reports: runs returned TRUE, runs returned SPEC-DRIFT, runs returned UNVERIFIED.
 * Throws if any claim has fewer than REPEATS entries.
 */
export function summarize({ runs, allClaims, REPEATS = 3 }) {
  const falseClaims = allClaims.filter(c => c.label === "false");
  const trueClaims = allClaims.filter(c => c.label === "true");
  const unverifiableClaims = allClaims.filter(c => c.label === "unverifiable");

  let falseReturnedTrueCount = 0;
  let falseDetails = [];
  let unverifiableReturnedTrueCount = 0;
  let unverifiableDetails = [];
  let trueReturnedTrueCount = 0;
  let trueSpectrumDriftCount = 0;   // NEW: true claims that returned SPEC-DRIFT
  let trueSpectrumDriftDetails = []; // NEW: details of SPEC-DRIFT cases
  let trueDetails = [];              // TRUE-labeled claims returned TRUE (with cited line)
  let trueDetailsSdrift = [];        // TRUE-labeled claims returned SPEC-DRIFT (with cited line)
  let verdictChanged = 0;
  let changedDetails = [];
  const allLatencies = [];

  for (const claim of allClaims) {
    // Per-claim: only runs where claimId matches this claim's id
    const claimRuns = runs.filter(r => r.some(rr => rr.claimId === claim.id));

    // If any claim has fewer than REPEATS entries, throw so the check catches it
    const claimFlat = claimRuns.flat();
    if (claimFlat.length < REPEATS) {
      throw new Error(`[summarize] Claim ${claim.id} has ${claimFlat.length}/${REPEATS} runs — missing data`);
    }

    // Verdicts from THIS claim's runs only (not flattened with other claims)
    const verdicts = claimFlat.map(r => r.verdict);

    // Track latencies from THIS claim's runs only
    for (const run of claimRuns) {
      for (const r of run) {
        if (r.claimId === claim.id && r.timings?.total !== undefined) {
          allLatencies.push(r.timings.total);
        }
      }
    }

    // Check if verdict changed between runs (for THIS claim only)
    const uniqueVerdicts = [...new Set(verdicts)];
    if (uniqueVerdicts.length > 1) {
      verdictChanged++;
      changedDetails.push(`${claim.id}: ${uniqueVerdicts.join(" → ")} (label: ${claim.label})`);
    }

    // Count by label
    if (claim.label === "false" && verdicts.includes("TRUE")) {
      falseReturnedTrueCount++;
      const runWithTrue = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "TRUE"));
      const citedLine = runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A";
      falseDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
    }

    if (claim.label === "unverifiable" && verdicts.includes("TRUE")) {
      unverifiableReturnedTrueCount++;
      unverifiableDetails.push(`${claim.id}: "${claim.text}" — cited: ${runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A"}`);
    }

    if (claim.label === "true") {
      // TRUE claims: count how many runs returned TRUE, SPEC-DRIFT, or UNVERIFIED
      const trueCount = verdicts.filter(v => v === "TRUE").length;
      const sdriftCount = verdicts.filter(v => v === "SPEC-DRIFT").length;
      trueReturnedTrueCount += trueCount;
      trueSpectrumDriftCount += sdriftCount; // NEW

      // Record details for TRUE returns (with cited line)
      if (trueCount > 0) {
        const runWithTrue = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "TRUE"));
        const citedLine = runWithTrue?.find(r => r.claimId === claim.id)?.specReference || "N/A";
        trueDetails.push(`${claim.id}: "${claim.text}" — cited: ${citedLine}`);
      }

      // Record details for SPEC-DRIFT returns (with cited line) — NEW
      if (sdriftCount > 0) {
        const runWithSdrift = claimRuns.find(r => r.some(rr => rr.claimId === claim.id && rr.verdict === "SPEC-DRIFT"));
        const citedLine = runWithSdrift?.find(r => r.claimId === claim.id)?.specReference || "N/A";
        trueDetailsSdrift.push(`${claim.id}: "${claim.text}" — cited: ${citedLine} — SPEC-DRIFT`);
      }
    }
  }

  const totalFalse = falseClaims.length * REPEATS;
  const totalUnverifiable = unverifiableClaims.length * REPEATS;
  const totalTrue = trueClaims.length * REPEATS;
  const totalChecks = allClaims.length;

  return {
    falseClaimsReturnedTrue: { count: falseReturnedTrueCount, total: totalFalse, details: falseDetails },
    unverifiableClaimsReturnedTrue: { count: unverifiableReturnedTrueCount, total: totalUnverifiable, details: unverifiableDetails },
    trueClaimsReturnedTrue: { count: trueReturnedTrueCount, total: totalTrue, details: trueDetails },
    trueClaimsReturnedSPEC_DRIFT: { count: trueSpectrumDriftCount, total: totalTrue, details: trueDetailsSdrift }, // NEW
    verdictChangedBetweenRuns: { count: verdictChanged, total: totalChecks, details: changedDetails },
    medianLatencyMs: allLatencies.length > 0
      ? Math.round(allLatencies.sort((a, b) => a - b)[Math.floor(allLatencies.length / 2)])
      : 0,
    p95LatencyMs: allLatencies.length > 0
      ? Math.round(allLatencies.sort((a, b) => a - b)[Math.ceil(0.95 * allLatencies.length) - 1])
      : 0
  };
}