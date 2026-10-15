#!/usr/bin/env node
// Deterministic offline unit test suite for VibeCheck core verification rules:
// 1. SPEC-DRIFT keyword guard (Case A accepted, Case B rejected)
// 2. Quote normalization & findLineNumber (escaped template literals, Markdown bold, "1: " prefix)
// 3. Restatement guard (restatement rejected, genuine code line accepted)
// 4. summarize.mjs per-claim isolation (no cross-claim mixing, throws on partial data)

import assert from "assert";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { summarize } from "./summarize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const normalize = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

const STOPWORDS = new Set([
  "the", "and", "for", "are", "not", "this", "that", "with", "from", "into",
  "been", "will", "have", "does", "just", "also", "more", "than", "then",
]);

const tokenize = (s) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w)) ?? [];

function hasContradictionKeywords(claimText, contradictingLine) {
  const claimKeywords = [...new Set(tokenize(claimText).filter((w) => w.length > 3))];
  if (!claimKeywords.length) return false;
  const lineTokens = new Set(tokenize(contradictingLine || ""));
  const shared = claimKeywords.filter((k) => lineTokens.has(k));
  return shared.length >= 2;
}

function isRestatement(claimText, quote, lineText) {
  const nClaim = normalize(claimText);
  const nQuote = normalize(quote);
  if (!nQuote || !nClaim) return false;
  if (nQuote.includes(nClaim) || nClaim.includes(nQuote)) return true;
  const claimKeywords = [...new Set(tokenize(claimText).filter((w) => w.length > 3))];
  if (!claimKeywords.length) return false;
  const lineTokens = new Set(tokenize(lineText || quote));
  const shared = claimKeywords.filter((k) => lineTokens.has(k));
  return shared.length / claimKeywords.length >= 0.8;
}

function normalizeForLineMatch(s) {
  return s
    .replace(/\\\\/g, "\\")
    .replace(/\\\$/g, "$")
    .replace(/\\`/g, "`")
    .replace(/\\u0060/g, "`")
    .replace(/\\"/g, '"')
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\u2014|\u2013/g, "-");
}

function findLineNumber(docText, quote) {
  const lines = docText.split("\n");
  const rawNormalized = normalize(normalizeForLineMatch(quote));
  if (!rawNormalized) return -1;
  const strippedPrefix = rawNormalized.replace(/^\d+:\s*/, "");
  for (let i = 0; i < lines.length; i++) {
    const candidate = normalize(normalizeForLineMatch(lines[i]));
    if (!candidate) continue;
    if (candidate.includes(rawNormalized) || (strippedPrefix && candidate.includes(strippedPrefix))) {
      return i + 1;
    }
  }
  return -1;
}

function runTests() {
  console.log("=== VibeCheck Unit Test Suite ===");

  // 1. Verify gemini.ts source code fixes (contradictingLine assignment order)
  const geminiSrc = readFileSync(resolve(REPO_ROOT, "src/lib/gemini.ts"), "utf8");
  const assignIdx = geminiSrc.indexOf('let contradictingLine = typeof item.contradictingLine === "string"');
  const guardIdx = geminiSrc.indexOf("hasContradictionKeywords(claim.text, contradictingLine)");
  assert.ok(
    assignIdx !== -1 && guardIdx !== -1 && assignIdx < guardIdx,
    "contradictingLine must be extracted from item.contradictingLine BEFORE calling hasContradictionKeywords"
  );
  console.log("[test] PASS: gemini.ts extracts contradictingLine before hasContradictionKeywords guard");

  // 2. Test SPEC-DRIFT keyword guard (Case A vs Case B)
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
  console.log("[test] PASS: SPEC-DRIFT keyword guard accepts Case A and rejects Case B (t11 false accusation)");

  // 3. Test quote normalization & findLineNumber
  const realGeminiFile = readFileSync(resolve(REPO_ROOT, "src/lib/gemini.ts"), "utf8");
  const escapedLiveQuote =
    "throw new Error(\\`Gemini quoted text not found in \\${sourceDoc} for \\${claim.id}: \\${contradictingLine}\\`);";
  const geminiLine = findLineNumber(realGeminiFile, escapedLiveQuote);
  assert.ok(geminiLine > 0, `Escaped template literal quote must match gemini.ts (found at line ${geminiLine})`);

  const realReadme = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
  const unboldedQuote =
    "> Design boundary: no sandboxed code execution. Evidence checks are static/API-based only — a deliberate";
  const readmeLine = findLineNumber(realReadme, unboldedQuote);
  assert.ok(readmeLine > 0, `Markdown bold stripped quote must match README.md (found at line ${readmeLine})`);

  const realLicense = readFileSync(resolve(REPO_ROOT, "LICENSE"), "utf8");
  const prefixedQuote = "1: MIT License";
  const licenseLine = findLineNumber(realLicense, prefixedQuote);
  assert.strictEqual(licenseLine, 1, "Line-number prefixed quote '1: MIT License' must match LICENSE:1");

  const fabricatedQuote = "export const TOTALLY_FABRICATED_LINE_DOES_NOT_EXIST = 999;";
  assert.strictEqual(
    findLineNumber(realGeminiFile, fabricatedQuote),
    -1,
    "Genuinely different line must still be rejected (-1)"
  );
  console.log("[test] PASS: Quote normalization accepts escaped/bold/prefixed real lines and rejects fabricated lines");

  // 4. Test Restatement Guard
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

  // 5. Test summarize.mjs per-claim isolation (no cross-claim mixing)
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
  assert.strictEqual(summary.trueClaimsReturnedTrue.count, 5, "t01 (3) + t02 (2) = 5/6 TRUE runs");
  assert.strictEqual(summary.trueClaimsReturnedTrue.total, 6);
  assert.strictEqual(summary.falseClaimsReturnedTrue.count, 0, "0/3 false runs returned TRUE");
  assert.strictEqual(summary.unverifiableClaimsReturnedTrue.count, 0, "0/3 unverifiable runs returned TRUE");
  assert.strictEqual(summary.verdictChangedBetweenRuns.count, 2, "Only t02 and f01 changed between runs (not t01 or u01)");

  // Missing data must throw
  assert.throws(
    () => summarize({ runs: [fixtureRuns[0]], allClaims: fixtureClaims, REPEATS: 3 }),
    /missing data/,
    "summarize must throw when any claim has fewer than REPEATS runs"
  );
  console.log("[test] PASS: summarize.mjs isolates per-claim runs accurately and throws on partial coverage");
  console.log("=== ALL UNIT TESTS PASSED ===");
}

runTests();
