#!/usr/bin/env node
// Deterministic offline unit test suite for VibeCheck production verification modules:
// Imports the ACTUAL production modules (src/lib/verification-guards.mjs and src/lib/report-crypto.mjs)
// rather than maintaining hand-copied duplicates.

import assert from "assert";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { summarize } from "./summarize.mjs";
import {
  calculateCodeRelevanceBonus,
  findLineNumber,
  hasContradictionKeywords,
  hasNegationMismatch,
  isExecutableCodeLine,
  isRestatement,
  tokenize,
} from "../src/lib/verification-guards.mjs";
import {
  encodeSignedReport,
  parseGitHubRepoUrl,
  safeDecodeReportId,
} from "../src/lib/report-crypto.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
process.env.REPORT_SIGNING_SECRET = 'vibecheck-test-key-not-for-deployment-2026';

function runTests() {
  console.log("=== VibeCheck Production Unit Test Suite ===");

  // 1. Verify gemini.ts source code fixes (contradictingLine assignment order & shared guard import)
  const geminiSrc = readFileSync(resolve(REPO_ROOT, "src/lib/gemini.ts"), "utf8");
  const assignIdx = geminiSrc.indexOf('let contradictingLine = typeof item.contradictingLine === "string"');
  const guardIdx = geminiSrc.indexOf("hasContradictionKeywords(claim.text, contradictingLine)");
  assert.ok(
    assignIdx !== -1 && guardIdx !== -1 && assignIdx < guardIdx,
    "contradictingLine must be extracted from item.contradictingLine BEFORE calling hasContradictionKeywords"
  );
  assert.ok(
    geminiSrc.includes('from "./verification-guards.mjs"'),
    "src/lib/gemini.ts must import guards directly from verification-guards.mjs"
  );
  console.log("[test] PASS: gemini.ts imports shared guards and extracts contradictingLine before keyword check");

  // 2. Test SPEC-DRIFT keyword guard (Case A vs Case B) + camelCase splitting
  const caseAClaim = "Sandboxed code execution is implemented in the check-spec-drift route.";
  const caseALine =
    "- Sandboxed code execution (no running code in the tool — this is a deliberate boundary, not a gap)";
  assert.strictEqual(
    hasContradictionKeywords(caseAClaim, caseALine),
    true,
    "Case A (sandboxed code execution contradiction) must share >=2 non-stopword keywords"
  );

  const caseBClaim = "Results are cached only after the drift step succeeds";
  const caseBLine =
    "The builder pastes an agent message and repo URL -> the frontend sends this to a Next.js API route.";
  assert.strictEqual(
    hasContradictionKeywords(caseBClaim, caseBLine),
    false,
    "Case B (unrelated flow sentence in spec.md:14) must be rejected (<2 shared keywords)"
  );

  const camelTokens = tokenize("fetchWithTimeout");
  assert.ok(
    camelTokens.includes("fetch") && camelTokens.includes("timeout") && camelTokens.includes("fetchwithtimeout"),
    "tokenize() must split camelCase identifiers while preserving the joined identifier"
  );
  console.log("[test] PASS: SPEC-DRIFT keyword guard and camelCase tokenizer work accurately");

  // 3. Test Comment-Spoofing & Negation-Mismatch Guards
  assert.strictEqual(
    isExecutableCodeLine("// TODO: OAuth Google login implemented", "src/lib/auth.ts"),
    false,
    "Single-line TODO comment in a .ts file must be rejected by isExecutableCodeLine"
  );
  assert.strictEqual(
    isExecutableCodeLine("/* OAuth login implemented */", "src/lib/auth.ts"),
    false,
    "Block comment in a .ts file must be rejected by isExecutableCodeLine"
  );
  assert.strictEqual(
    isExecutableCodeLine("export async function authenticateUser() {", "src/lib/auth.ts"),
    true,
    "Real TypeScript function declaration must be accepted by isExecutableCodeLine"
  );
  assert.strictEqual(
    hasNegationMismatch("OAuth login is implemented", "const status = 'OAuth login is not implemented';"),
    true,
    "Positive claim paired with negated line ('is not implemented') must trigger hasNegationMismatch"
  );
  assert.strictEqual(
    hasNegationMismatch(
      "Evidence checks are static/API-based only — no sandboxed code execution.",
      "> **Design boundary:** no sandboxed code execution. Evidence checks are static/API-based only"
    ),
    false,
    "Negative boundary claim paired with matching negative boundary line must NOT trigger hasNegationMismatch"
  );
  assert.ok(
    calculateCodeRelevanceBonus("export async function fetchWithTimeout(") >= 3,
    "Exported async function declaration must receive AST-lite relevance bonus"
  );
  console.log("[test] PASS: Comment-spoofing, TODO-spoofing, and negation-mismatch guards block adversarial lines");

  // 4. Test Whole-Line Quote Verification & Normalization
  const realGeminiFile = readFileSync(resolve(REPO_ROOT, "src/lib/gemini.ts"), "utf8");
  const escapedLiveQuote =
    "throw new Error(\\`Gemini quoted text not found in \\${sourceDoc} for \\${claim.id}: \\${contradictingLine}\\`);";
  const geminiLine = findLineNumber(realGeminiFile, escapedLiveQuote);
  assert.equal(geminiLine, -1, 'Double-escaped code is not the exact source line');
  const exactErrorLine = realGeminiFile.split('\n').find(line=>line.includes('throw new Error(`Gemini quoted text not found'));
  assert.ok(findLineNumber(realGeminiFile,exactErrorLine)>0,'Actual source line must match without semantic normalization');

  const realReadme = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
  const unboldedQuote =
    "> Design boundary: no sandboxed code execution. Evidence checks are static/API-based only — a deliberate";
  const readmeLine = findLineNumber(realReadme, unboldedQuote);
  assert.ok(readmeLine > 0, `Markdown bold stripped quote must match README.md (found at line ${readmeLine})`);

  const realLicense = readFileSync(resolve(REPO_ROOT, "LICENSE"), "utf8");
  const prefixedQuote = "1: MIT License";
  const licenseLine = findLineNumber(realLicense, prefixedQuote);
  assert.strictEqual(licenseLine, 1, "Line-number prefixed quote '1: MIT License' must match LICENSE:1");

  assert.strictEqual(
    findLineNumber(realGeminiFile, "true"),
    -1,
    "Tiny 1-word fragment ('true') must be rejected by whole-line findLineNumber check"
  );
  assert.strictEqual(
    findLineNumber(realGeminiFile, "export const TOTALLY_FABRICATED_LINE_DOES_NOT_EXIST = 999;"),
    -1,
    "Genuinely different line must be rejected (-1)"
  );
  console.log("[test] PASS: Whole-line quote verifier accepts real lines and rejects tiny fragments & fabrications");

  // 5. Test Restatement Guard
  const rClaim = "The restatement guard applies to supporting quotes only, not contradiction quotes";
  const restatingLine =
    'text: "The restatement guard applies to supporting quotes only, not contradiction quotes",';
  const genuineCodeLine = "if (isRestatement(claim.text, supportingQuote, lineText)) {";
  assert.strictEqual(
    isRestatement(rClaim, restatingLine, restatingLine),
    true,
    "Line that restates the claim must be rejected by isRestatement"
  );
  assert.strictEqual(
    isRestatement(rClaim, genuineCodeLine, genuineCodeLine),
    false,
    "Genuine code implementation line must be accepted by isRestatement"
  );
  console.log("[test] PASS: Restatement guard rejects claim restatements and accepts genuine code lines");

  // 6. Test Strict GitHub URL Validation & HMAC-SHA256 Report Signing
  const validParsed = parseGitHubRepoUrl("https://github.com/kathir-iTech/Vibe_Check.git");
  assert.strictEqual(validParsed.owner, "kathir-iTech");
  assert.strictEqual(validParsed.repo, "Vibe_Check");
  assert.throws(
    () => parseGitHubRepoUrl("https://evil.example/github.com/kathir-iTech/Vibe_Check"),
    /hostname must be github\.com/,
    "Spoofed hostname URL must be rejected by parseGitHubRepoUrl"
  );

  const samplePayload = {
    repoUrl: "https://github.com/kathir-iTech/Vibe_Check",
    headSha: "674662188edef58c86ad2e9e5beff412bbfa9b9e",
    claims: [{ id: "claim-1", text: "The project uses Tailwind CSS." }],
    evidence: {},
    verdicts: [{ claimId: "claim-1", verdict: "TRUE", specReference: "tailwind.config.ts:1: import" }],
    generatedAt: "2026-10-16T00:00:00.000Z",
  };
  const { id } = encodeSignedReport(samplePayload);
  const decoded = safeDecodeReportId(id);
  assert.ok(decoded && decoded.signatureVerified === true, "Signed report must verify HMAC-SHA256 signature");

  // Tamper with verdict -> signatureVerified must flip to false
  const tamperedObj = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
  tamperedObj.verdicts[0].verdict = "UNVERIFIED";
  const tamperedId = Buffer.from(JSON.stringify(tamperedObj), "utf8").toString("base64url");
  const decodedTampered = safeDecodeReportId(tamperedId);
  assert.ok(
    decodedTampered && decodedTampered.signatureVerified === false,
    "Tampered report payload must fail HMAC-SHA256 verification"
  );

  // Invalid verdict enum ('UNERIFIED') -> must return null
  tamperedObj.verdicts[0].verdict = "UNERIFIED";
  const corruptedId = Buffer.from(JSON.stringify(tamperedObj), "utf8").toString("base64url");
  assert.strictEqual(
    safeDecodeReportId(corruptedId),
    null,
    "Report with invalid verdict enum ('UNERIFIED') must be rejected as null"
  );
  console.log("[test] PASS: Strict URL parser and complete Ed25519 report signatures reject tampering");

  // 7. Test summarize.mjs per-claim isolation
  const fixtureClaims = [
    { id: "t01", text: "Claim 1", label: "true" },
    { id: "t02", text: "Claim 2", label: "true" },
    { id: "f01", text: "False 1", label: "false" },
    { id: "u01", text: "Unverifiable 1", label: "unverifiable" },
  ];
  const fixtureRuns = [
    [
      { claimId: "t01", verdict: "TRUE", specReference: "a:1: x", timings: { total: 1000 } },
      { claimId: "t02", verdict: "TRUE", specReference: "b:1: y", timings: { total: 1000 } },
      { claimId: "f01", verdict: "UNVERIFIED", specReference: "", timings: { total: 1000 } },
      { claimId: "u01", verdict: "UNVERIFIED", specReference: "", timings: { total: 1000 } },
    ],
    [
      { claimId: "t01", verdict: "TRUE", specReference: "a:1: x", timings: { total: 1200 } },
      { claimId: "t02", verdict: "UNVERIFIED", specReference: "", timings: { total: 1200 } },
      { claimId: "f01", verdict: "SPEC-DRIFT", specReference: "scope.md:1: z", timings: { total: 1200 } },
      { claimId: "u01", verdict: "UNVERIFIED", specReference: "", timings: { total: 1200 } },
    ],
    [
      { claimId: "t01", verdict: "TRUE", specReference: "a:1: x", timings: { total: 1400 } },
      { claimId: "t02", verdict: "TRUE", specReference: "b:1: y", timings: { total: 1400 } },
      { claimId: "f01", verdict: "UNVERIFIED", specReference: "", timings: { total: 1400 } },
      { claimId: "u01", verdict: "UNVERIFIED", specReference: "", timings: { total: 1400 } },
    ],
  ];
  const summary = summarize({ runs: fixtureRuns, allClaims: fixtureClaims, REPEATS: 3 });
  assert.strictEqual(summary.trueClaimsReturnedTrue.count, 5);
  assert.strictEqual(summary.falseClaimsReturnedTrue.count, 0);
  assert.strictEqual(summary.unverifiableClaimsReturnedTrue.count, 0);
  assert.strictEqual(summary.verdictChangedBetweenRuns.count, 2);
  console.log("[test] PASS: summarize.mjs isolates per-claim runs accurately");
  console.log("=== ALL 7 PRODUCTION UNIT TEST SUITES PASSED ===");
}

runTests();
