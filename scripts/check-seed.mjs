#!/usr/bin/env node
// Check that the self-audit seed claim texts match the source JSON.
// Exits non-zero if any seed claim text differs from self-audit-claims.json.
// Usage: node scripts/check-seed.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(REPO_ROOT, "src/lib/self-audit-seed.ts");
const CLAIMS_JSON_PATH = resolve(REPO_ROOT, "src/lib/self-audit-claims.json");

function extractClaimsFromSeed() {
  const content = readFileSync(SEED_PATH, "utf8");
  // Find the SELF_AUDIT_SEED array and parse it
  const match = content.match(/export const SELF_AUDIT_SEED: SelfAuditResult = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("Could not find SELF_AUDIT_SEED claims array in seed file");
  }
  return JSON.parse(match[1]);
}

function loadSourceClaims() {
  const content = readFileSync(CLAIMS_JSON_PATH, "utf8");
  return JSON.parse(content);
}

function main() {
  const seedClaims = extractClaimsFromSeed();
  const sourceClaims = loadSourceClaims();
  
  if (seedClaims.length !== sourceClaims.length) {
    console.error(`[check-seed] FAIL: Claim count mismatch (seed: ${seedClaims.length}, source: ${sourceClaims.length})`);
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
    } else {
      console.log(`[check-seed] OK: Claim ${i} (${sourceClaims[i].id}) matches`);
    }
  }
  
  if (hasError) {
    console.error("[check-seed] Seed verification FAILED");
    process.exit(1);
  } else {
    console.log("[check-seed] All seed claim texts match source JSON");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[check-seed] Error:", err.message);
  process.exit(1);
});