import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const base = process.env.BASE_URL || "http://localhost:3018";
const subjects = ["expressjs/express", "chalk/chalk"];
// Refuse stale declared verifier hashes before consuming any provider capacity.
execFileSync(process.execPath, ["scripts/evaluate-verifier.mjs"], { stdio: "pipe" });
const record = {
  schema: "vibecheck/live-source-evaluation/v1",
  scope:
    "Actual builder API requests on two external public repositories. Labels are derived from the pinned package manifest. This is a small selected demonstration, not independent-user testing or a population accuracy estimate.",
  startedAt: new Date().toISOString(),
  verifierRevision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  verifierInputHashes: JSON.parse(
    readFileSync("benchmark/v2/adversarial.json", "utf8"),
  ).currentInputHashes,
  attempts: [],
};
const gh = (path) =>
  JSON.parse(
    execFileSync("gh", ["api", path], { encoding: "utf8", timeout: 30000 }),
  );
mkdirSync("benchmark/v2/live", { recursive: true });
for (const subject of subjects) {
  const attempt = { repository: subject, startedAt: new Date().toISOString() };
  record.attempts.push(attempt);
  try {
    const head = gh(`repos/${subject}/commits/HEAD`).sha;
    const file = gh(`repos/${subject}/contents/package.json?ref=${head}`);
    const text = Buffer.from(file.content, "base64").toString("utf8");
    const manifest = JSON.parse(text);
    if (manifest.license !== "MIT")
      throw new Error(
        "Expected licensing control differs; do not invent a label",
      );
    if (manifest.dependencies?.["@google/genai"])
      throw new Error("Absent-dependency control is present");
    const second = subject.startsWith("express")
      ? "The package declares accepts as a dependency."
      : "The package is configured for ES modules.";
    if (subject.startsWith("express") && !manifest.dependencies?.accepts)
      throw new Error("Dependency control differs");
    if (subject.startsWith("chalk") && manifest.type !== "module")
      throw new Error("Module-type control differs");
    const claims = [
      { id: "license", text: "This package is MIT licensed." },
      { id: "manifest", text: second },
      {
        id: "absent",
        text: "The package declares @google/genai as a dependency.",
      },
      { id: "execution", text: "All unit tests passed." },
    ];
    attempt.headSha = head;
    attempt.expected = {
      license: "TRUE",
      manifest: "TRUE",
      absent: "UNVERIFIED",
      execution: "UNVERIFIED",
    };
    attempt.groundTruth = {
      path: "package.json",
      sha256: createHash("sha256").update(text).digest("hex"),
      license: manifest.license,
      type: manifest.type || null,
      accepts: manifest.dependencies?.accepts || null,
      hasGoogleGenai: false,
    };
    const response = await fetch(`${base}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl: `https://github.com/${subject}`,
        headSha: head,
        claims,
      }),
      signal: AbortSignal.timeout(190000),
    });
    const result = await response.json();
    attempt.httpStatus = response.status;
    if (!response.ok || result.error)
      throw new Error(result.error || `HTTP ${response.status}`);
    attempt.actual = Object.fromEntries(
      result.audit.verdicts.map((v) => [v.claimId, v.verdict]),
    );
    attempt.matches = Object.entries(attempt.expected).filter(
      ([id, value]) => attempt.actual[id] === value,
    ).length;
    attempt.resultFile = `live/${subject.replace("/", "-")}.json`;
    writeFileSync(
      `benchmark/v2/${attempt.resultFile}`,
      JSON.stringify(result.audit, null, 2) + "\n",
    );
  } catch (error) {
    attempt.error = error.message;
  }
  attempt.finishedAt = new Date().toISOString();
  writeFileSync(
    "benchmark/v2/live-evaluation.json",
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      repository: subject,
      httpStatus: attempt.httpStatus,
      matches: attempt.matches,
      error: attempt.error,
    }),
  );
}
record.finishedAt = new Date().toISOString();
record.summary = {
  requests: record.attempts.length,
  completed: record.attempts.filter((a) => a.actual).length,
  labeledClaims: record.attempts.filter((a) => a.actual).length * 4,
  matchedOutcomes: record.attempts.reduce(
    (sum, a) => sum + (a.matches || 0),
    0,
  ),
  errors: record.attempts.filter((a) => a.error).length,
};
writeFileSync(
  "benchmark/v2/live-evaluation.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify(record.summary));
if (record.summary.errors || record.summary.matchedOutcomes !== 8)
  process.exitCode = 1;
