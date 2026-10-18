import nextEnv from "@next/env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadProduction } from "./test-support.mjs";
import { evidenceObligation } from "../src/lib/audit-policy.mjs";
nextEnv.loadEnvConfig(process.cwd());
const input = process.argv[2];
if (!/^[a-z0-9-]{1,48}$/.test(input || ""))
  throw new Error("Supply an existing run name.");
const target = `benchmark/v3/${input}-validator-replay.json`;
if (existsSync(target)) throw new Error("Replay exists; preserve it.");
const original = JSON.parse(readFileSync(`benchmark/v3/${input}.json`, "utf8"));
const plan = JSON.parse(readFileSync("benchmark/v3/plan.json", "utf8"));
const { fetchFileContentsForClaims } = loadProduction("src/lib/github.ts");
const { validateAssessments, extractJson } =
  loadProduction("src/lib/gemini.ts");
const hash = (p) =>
  createHash("sha256")
    .update(readFileSync(p, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex");
const result = {
  scope:
    "Deterministic replay of previously recorded real model answers against the current validator and freshly retrieved pinned public source. No new model calls, independent labels, new live audit or report issuance. Earlier live outcomes are preserved unchanged.",
  recordedRun: input,
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceHashes: Object.fromEntries(
    [
      "src/lib/gemini.ts",
      "src/lib/evidence-depth.mjs",
      "src/lib/source-window.mjs",
      "src/lib/github.ts",
    ].map((p) => [p, hash(p)]),
  ),
  startedAt: new Date().toISOString(),
  subjects: [],
};
for (const attempt of original.attempts.filter((a) => a.httpStatus === 200)) {
  const subject = plan.subjects.find(
    (s) => s.repository === attempt.repository && s.headSha === attempt.headSha,
  );
  if (!subject) throw new Error("Recorded subject differs from frozen plan.");
  const claims = subject.claims.filter(
    (c) => !["execution", "runtime"].includes(evidenceObligation(c.text)),
  );
  const files = await fetchFileContentsForClaims(
    `https://api.github.com/repos/${subject.repository}`,
    Object.fromEntries(claims.map((c) => [c.id, subject.fileHints])),
    undefined,
    subject.headSha,
    Object.fromEntries(claims.map((c) => [c.id, c.text])),
  );
  const rows = validateAssessments(
    extractJson(attempt.providerAnswers.at(-1).text),
    claims,
    [],
    files,
  );
  const outcomes = subject.claims.map((c) => {
    const row = rows.find((r) => r.claimId === c.id);
    const actual = row
      ? row.supported
        ? row.coverage === "full"
          ? "TRUE"
          : "PARTIAL"
        : "UNVERIFIED"
      : "UNVERIFIED";
    return { id: c.id, actual, matched: c.allowed.includes(actual) };
  });
  result.subjects.push({
    repository: subject.repository,
    headSha: subject.headSha,
    outcomes,
  });
}
const all = result.subjects.flatMap((s) => s.outcomes);
result.summary = {
  subjects: result.subjects.length,
  claims: all.length,
  matched: all.filter((o) => o.matched).length,
};
result.finishedAt = new Date().toISOString();
writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary));
