// Actual network evaluation of the production assessment handler. The SDK
// wrapper observes real provider answers; it never manufactures a response.
import nextEnv from "@next/env";
import { GoogleGenAI as NativeGoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadProduction } from "./test-support.mjs";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.GEMINI_API_KEY)
  throw new Error("A configured provider is required.");
const planBytes = readFileSync("benchmark/v3/plan.json", "utf8").replace(/\r\n/g, "\n");
const plan = JSON.parse(planBytes);
const runName = process.argv[2];
if (!/^[a-z0-9-]{1,48}$/.test(runName || ""))
  throw new Error(
    "Supply a new bounded run name; existing results are never overwritten.",
  );
const target = `benchmark/v3/${runName}.json`;
if (existsSync(target))
  throw new Error("Run exists; use another name and preserve it.");
const paths = [
  "src/lib/gemini.ts",
  "src/lib/evidence-depth.mjs",
  "src/lib/source-window.mjs",
  "src/lib/audit-policy.mjs",
  "src/lib/github.ts",
  "src/app/api/check-spec-drift/route.ts",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const record = {
  schema: "vibecheck/product-assessment-observation/v1",
  scope:
    "Actual GitHub and Gemini calls through the production assessment handler, with builder-authored frozen evidence-class labels. Retrieval uses explicit pinned file hints; this does not measure automatic discovery. The baseline is the same real model response interpreted before deterministic validation, not a competitor product or independent user study.",
  planSha256: sha256(planBytes),
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceHashes: Object.fromEntries(
    paths.map((p) => [
      p,
      sha256(readFileSync(p, "utf8").replace(/\r\n/g, "\n")),
    ]),
  ),
  startedAt: new Date().toISOString(),
  attempts: [],
};
mkdirSync("benchmark/v3", { recursive: true });
const save = () =>
  writeFileSync(target, JSON.stringify(record, null, 2) + "\n");
save();
for (const subject of plan.subjects) {
  const answers = [];
  const calls = [];
  const { POST } = loadProduction("src/app/api/check-spec-drift/route.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        constructor(options) {
          const native = new NativeGoogleGenAI(options);
          this.models = {
            generateContent: async (request) => {
              const started = performance.now();
              try {
                const result = await native.models.generateContent(request);
                answers.push({
                  model: request.model,
                  text: result.text,
                  usage: result.usageMetadata,
                });
                calls.push({
                  model: request.model,
                  status: "completed",
                  durationMs: Math.round(performance.now() - started),
                });
                return result;
              } catch (error) {
                calls.push({
                  model: request.model,
                  status: "failed",
                  durationMs: Math.round(performance.now() - started),
                  error: String(error.message || error),
                });
                throw error;
              }
            },
          };
        }
      },
    },
  });
  const attempt = {
    repository: subject.repository,
    headSha: subject.headSha,
    startedAt: new Date().toISOString(),
    providerCalls: calls,
  };
  record.attempts.push(attempt);
  save();
  const started = performance.now();
  try {
    const response = await POST({
      headers: new Headers(),
      signal: AbortSignal.timeout(80000),
      json: async () => ({
        repoUrl: subject.repoUrl,
        headSha: subject.headSha,
        planningFiles: [],
        claims: subject.claims.map(({ id, text }) => ({ id, text })),
        evidence: Object.fromEntries(
          subject.claims.map((c) => [
            c.id,
            { headSha: subject.headSha, files: subject.fileHints },
          ]),
        ),
      }),
    });
    const body = await response.json();
    attempt.httpStatus = response.status;
    attempt.result = body;
    let raw = [];
    if (answers.length) {
      attempt.providerAnswers = answers;
      const { extractJson } = loadProduction("src/lib/gemini.ts");
      try {
        raw = extractJson(answers.at(-1).text);
      } catch {
        /* malformed answers are retained */
      }
    }
    attempt.outcomes = subject.claims.map((c) => {
      const finding = body.drift?.find((v) => v.claimId === c.id);
      const model = Array.isArray(raw)
        ? raw.find((v) => v.claimId === c.id)
        : null;
      const baseline = model
        ? model.supported === true
          ? model.coverage === "full"
            ? model.contradicts
              ? "SPEC-DRIFT"
              : "TRUE"
            : "PARTIAL"
          : "UNVERIFIED"
        : finding?.obligation === "execution" ||
            finding?.obligation === "runtime"
          ? "UNVERIFIED"
          : "NOT ASSESSED";
      return {
        id: c.id,
        kind: c.kind,
        allowed: c.allowed,
        actual: finding?.verdict || "NOT ASSESSED",
        baseline,
        matched: !!finding && c.allowed.includes(finding.verdict),
        baselineMatched: c.allowed.includes(baseline),
      };
    });
  } catch (error) {
    attempt.error = String(error.message || error);
  }
  attempt.durationMs = Math.round(performance.now() - started);
  attempt.finishedAt = new Date().toISOString();
  save();
  console.log(
    `${subject.repository}: HTTP ${attempt.httpStatus || "error"}; ${attempt.outcomes?.filter((o) => o.matched).length || 0}/${subject.claims.length} expected outcomes; ${attempt.durationMs}ms`,
  );
}
record.finishedAt = new Date().toISOString();
const outcomes = record.attempts.flatMap((a) => a.outcomes || []);
record.summary = {
  subjects: plan.subjects.length,
  completed: record.attempts.filter((a) => a.httpStatus === 200).length,
  plannedClaims: plan.subjects.reduce((n, s) => n + s.claims.length, 0),
  assessedClaims: outcomes.filter((o) => o.actual !== "NOT ASSESSED").length,
  matchedOutcomes: outcomes.filter((o) => o.matched).length,
  baselineMatchedOutcomes: outcomes.filter((o) => o.baselineMatched).length,
  unsupportedFullSupport: outcomes.filter(
    (o) => !o.allowed.includes("TRUE") && o.actual === "TRUE",
  ).length,
  baselineUnsupportedFullSupport: outcomes.filter(
    (o) => !o.allowed.includes("TRUE") && o.baseline === "TRUE",
  ).length,
  byKind: Object.fromEntries(
    [...new Set(outcomes.map((o) => o.kind))].map((kind) => {
      const rows = outcomes.filter((o) => o.kind === kind);
      return [
        kind,
        {
          total: rows.length,
          assessed: rows.filter((o) => o.actual !== "NOT ASSESSED").length,
          matched: rows.filter((o) => o.matched).length,
        },
      ];
    }),
  ),
};
save();
console.log(JSON.stringify(record.summary, null, 2));
