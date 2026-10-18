import { readFileSync, writeFileSync } from "node:fs";
const runs = process.argv.slice(2);
if (!runs.length || runs.some((name) => !/^[a-z0-9-]{1,48}$/.test(name)))
  throw new Error("Supply recorded run names.");
const summary = runs.map((name) => {
  const record = JSON.parse(readFileSync(`benchmark/v3/${name}.json`, "utf8"));
  const rows = record.attempts.flatMap((a) => a.outcomes || []);
  const assessed = rows.filter((r) => r.actual !== "NOT ASSESSED");
  const positive = assessed.filter(
    (r) => r.allowed.length === 1 && r.allowed[0] === "TRUE",
  );
  const unsupported = assessed.filter((r) => !r.allowed.includes("TRUE"));
  const times = record.attempts
    .filter((a) => a.httpStatus === 200)
    .map((a) => a.durationMs)
    .sort((a, b) => a - b);
  return {
    run: name,
    planSha256: record.planSha256,
    sourceRevision: record.sourceRevision,
    completed: record.summary?.completed,
    planned: record.summary?.subjects,
    assessed: assessed.length,
    plannedClaims: record.summary?.plannedClaims,
    expectedOutcomes: assessed.filter((r) => r.matched).length,
    sourceSupportRecovered: positive.filter((r) => r.actual === "TRUE").length,
    sourceSupportExpected: positive.length,
    unsupportedFullSupport: unsupported.filter((r) => r.actual === "TRUE")
      .length,
    unsupportedAssessed: unsupported.length,
    baselineExpectedOutcomes: assessed.filter((r) => r.baselineMatched).length,
    medianCompletedRequestMs: times.length
      ? times[Math.floor(times.length / 2)]
      : null,
    providerFailures: record.attempts
      .flatMap((a) => a.providerCalls || [])
      .filter((c) => c.status === "failed").length,
  };
});
if (new Set(summary.map((s) => s.planSha256)).size !== 1)
  throw new Error(
    "Different frozen plans cannot be presented as a matched comparison.",
  );
const result = {
  scope:
    "Descriptive builder-run comparison on one frozen plan. Completed and failed requests remain separate. Repeated evaluation, provider variation and code changes prevent causal or population-accuracy conclusions. The baseline is an ablation of the same answers, not a competing product.",
  runs: summary,
};
if (process.env.WRITE_PRODUCT_SUMMARY === "1")
  writeFileSync(
    "benchmark/v3/summary.json",
    JSON.stringify(result, null, 2) + "\n",
  );
console.log(JSON.stringify(result, null, 2));
