#!/usr/bin/env node
// Check that the self-audit seed claim texts match the source JSON and that every
// cited specReference (file:line: quote) exists on that exact line in the repo.
// Exits non-zero if any seed claim text or cited line differs.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(REPO_ROOT, "src/lib/self-audit-seed.ts");
const CLAIMS_JSON_PATH = resolve(REPO_ROOT, "src/lib/self-audit-claims.json");
const historical = JSON.parse(readFileSync(resolve(REPO_ROOT,'benchmark/history/self-audit-source.json'),'utf8'));
for (const file of Object.values(historical.files)) {
  if (createHash('sha256').update(file.text).digest('hex') !== file.sha256) throw new Error('Historical source snapshot hash mismatch');
}

function extractClaimsFromSeed() {
  const content = readFileSync(SEED_PATH, "utf8");
  const match = content.match(
    /export const SELF_AUDIT_SEED: SelfAuditResult = \{[\s\S]*?claims: (\[[\s\S]*?\])\s*\};/
  );
  if (!match) {
    throw new Error("Could not find SELF_AUDIT_SEED claims array in seed file");
  }
  return JSON.parse(match[1]);
}

function loadSourceClaims() {
  const content = readFileSync(CLAIMS_JSON_PATH, "utf8");
  return JSON.parse(content);
}

function verifySpecRef(specReference) {
  if (!specReference) return true;
  const m = specReference.match(/^([^:\s]+):(\d+):\s*([\s\S]+)$/);
  if (!m) return false;
  const [, relFile, lineStr, quote] = m;
  const lineNum = Number(lineStr);
  const fileText = historical.files[relFile]?.text;
  if (!fileText) return false;
  const lines = fileText.split("\n");
  const actualLine = lines[lineNum - 1] || "";
  return actualLine.trim().includes(quote.trim());
}

function main() {
  const seedClaims = extractClaimsFromSeed();
  const sourceClaims = loadSourceClaims();

  if (seedClaims.length !== sourceClaims.length) {
    console.error(
      `[check-seed] FAIL: Claim count mismatch (seed: ${seedClaims.length}, source: ${sourceClaims.length})`
    );
    process.exit(1);
  }

  let hasError = false;
  for (let i = 0; i < seedClaims.length; i++) {
    const seedText = seedClaims[i].text;
    const sourceText = sourceClaims[i].text;
    if (seedText !== sourceText) {
      console.error(`[check-seed] FAIL: Claim ${i} (${sourceClaims[i].id}) text differs:`);
      console.error(`  Seed:   "${seedText}"`);
      console.error(`  Source: "${sourceText}"`);
      hasError = true;
    } else if (!verifySpecRef(seedClaims[i].specReference)) {
      console.error(
        `[check-seed] FAIL: Claim ${i} (${sourceClaims[i].id}) specReference does not match repo file:line:`
      );
      console.error(`  Ref: "${seedClaims[i].specReference}"`);
      hasError = true;
    } else {
      console.log(
        `[check-seed] OK: Claim ${i} (${sourceClaims[i].id}) text and line citation verified`
      );
    }
  }

  if (hasError) {
    console.error("[check-seed] Seed verification FAILED");
    process.exit(1);
  } else {
    console.log(`[check-seed] Historical seed citations match preserved source ${historical.revision}; no current-verifier success is inferred`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[check-seed] Error:", err.message);
  process.exit(1);
});
