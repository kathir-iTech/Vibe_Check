import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { loadProduction } from "./test-support.mjs";
import * as current from "../src/lib/verification-guards.mjs";
import * as cryptoCurrent from "../src/lib/report-crypto.mjs";

const root = resolve(import.meta.dirname, "..");
const history = JSON.parse(
  readFileSync(
    resolve(root, "benchmark/history/verification-source.json"),
    "utf8",
  ),
);
const loadText = (source) =>
  import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
const legacy = await loadText(history.files["src/lib/verification-guards.mjs"]);
const legacyCrypto = await loadText(history.files["src/lib/report-crypto.mjs"]);
process.env.REPORT_SIGNING_SECRET =
  "manufactured-evaluation-key-not-a-service-key";
const rows = [];
for (const [id, text, quote, expected] of [
  ["string-case", 'const method = "GET";', 'const method = "get";', false],
  ["identifier-case", "const UserID = 1;", "const userID = 1;", false],
  [
    "literal-whitespace",
    'const value = "a  b";',
    'const value = "a b";',
    false,
  ],
  ["literal-escape", 'const value = "$";', 'const value = "\\$";', false],
  [
    "partial-dead-code",
    "if (false) { authenticate(); }",
    "authenticate();",
    false,
  ],
  [
    "identifier-underscores",
    'const __role = "admin";',
    'const role = "admin";',
    false,
  ],
  ["invented-code", "const exists = 1;", "const fabricated = 9;", false],
  ["exact-code", "const exists = 1;", "const exists = 1;", true],
  ["line-prefix", "const exists = 1;", "1: const exists = 1;", true],
]) {
  rows.push({
    id,
    type: "manufactured-source-quote",
    source: text,
    quote,
    expectedAccepted: expected,
    legacyAccepted: legacy.findLineNumber(text, quote) > 0,
    currentAccepted: current.findLineNumber(text, quote) > 0,
  });
}
const payload = {
  repoUrl: "https://github.com/acme/example",
  headSha: "a".repeat(40),
  claims: [{ id: "c1", text: "An authentication function exists" }],
  evidence: { c1: { files: ["auth.ts"] } },
  verdicts: [
    {
      claimId: "c1",
      verdict: "TRUE",
      reason: "Source support",
      specReference: "auth.ts:1",
      supportingQuote: "export function auth() {}",
    },
  ],
  source: { kind: "live", label: "Manufactured evaluation fixture" },
  generatedAt: "2026-10-18T00:00:00Z",
};
for (const [id, mutate] of [
  ["evidence-filename", (p) => p.evidence.c1.files.push("invented.ts")],
  ["verdict-reason", (p) => (p.verdicts[0].reason = "Invented reason")],
  [
    "supporting-quote",
    (p) => (p.verdicts[0].supportingQuote = "Invented quote"),
  ],
  ["source-mode", (p) => (p.source.kind = "demo")],
  ["verdict-change", (p) => (p.verdicts[0].verdict = "UNVERIFIED")],
]) {
  const before = legacyCrypto.encodeSignedReport(payload).signedPayload;
  const after = cryptoCurrent.encodeSignedReport(payload).signedPayload;
  mutate(before);
  mutate(after);
  rows.push({
    id,
    type: "manufactured-report-tamper",
    expectedAccepted: false,
    legacyAccepted: legacyCrypto.safeDecodeReportId(
      Buffer.from(JSON.stringify(before)).toString("base64url"),
    ).signatureVerified,
    currentAccepted: cryptoCurrent.safeDecodeReportId(
      Buffer.from(JSON.stringify(after)).toString("base64url"),
    ).signatureVerified,
  });
}
const previousRoute = loadProduction(
  "src/app/api/generate-report/route.ts",
  { "@/lib/report-crypto.mjs": legacyCrypto },
  history.files["src/app/api/generate-report/route.ts"],
);
const currentRoute = loadProduction("src/app/api/generate-report/route.ts");
const request = () => ({
  json: async () => payload,
  headers: new Headers({ host: "localhost:3000" }),
  nextUrl: new URL("http://localhost:3000/api/generate-report"),
});
rows.push({
  id: "caller-authored-verdict",
  type: "manufactured-route-request",
  expectedAccepted: false,
  legacyAccepted: (await previousRoute.POST(request())).ok,
  currentAccepted: (await currentRoute.POST(request())).ok,
});
for (const row of rows)
  assert.equal(row.currentAccepted, row.expectedAccepted, row.id);
const inputs = [
  "src/lib/verification-guards.mjs",
  "src/lib/report-crypto.mjs",
  "src/lib/report-format.mjs",
  "src/lib/audit-policy.mjs",
  "src/lib/evidence-depth.mjs",
  "src/lib/source-window.mjs",
  "src/lib/gemini.ts",
  "src/lib/github.ts",
  "src/lib/audit-service.ts",
  "src/app/api/audit/route.ts",
  "src/app/api/check-evidence/route.ts",
  "src/app/api/check-spec-drift/route.ts",
  "src/app/api/generate-report/route.ts",
];
const hashes = Object.fromEntries(
  inputs.map((path) => [
    path,
    createHash("sha256")
      .update(readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n"))
      .digest("hex"),
  ]),
);
const record = {
  schema: "vibecheck/manufactured-verifier-evaluation/v1",
  scope:
    "Deliberately manufactured regression counterexamples evaluated against actual preserved legacy and current production functions/routes. No new model calls, independent-user evidence or population accuracy estimate.",
  legacyRevision: history.revision,
  currentInputHashes: hashes,
  cases: rows,
  summary: {
    cases: rows.length,
    currentExpectedOutcomes: rows.filter(
      (r) => r.currentAccepted === r.expectedAccepted,
    ).length,
    unsafeCases: rows.filter((r) => !r.expectedAccepted).length,
    legacyUnsafeAccepted: rows.filter(
      (r) => !r.expectedAccepted && r.legacyAccepted,
    ).length,
    currentUnsafeAccepted: rows.filter(
      (r) => !r.expectedAccepted && r.currentAccepted,
    ).length,
  },
};
const target = resolve(root, "benchmark/v2/adversarial.json");
if (process.argv.includes("--write")) {
  mkdirSync(resolve(root, "benchmark/v2"), { recursive: true });
  writeFileSync(target, JSON.stringify(record, null, 2) + "\n");
} else if (
  JSON.stringify(JSON.parse(readFileSync(target, "utf8"))) !==
  JSON.stringify(record)
) {
  console.error(
    "Published evaluation differs from normalized-LF source hashes or measured outcomes. Rerun --write and review.",
  );
  process.exit(1);
}
console.log(JSON.stringify(record.summary, null, 2));
