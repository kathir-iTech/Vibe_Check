#!/usr/bin/env node
// Regenerate the self-audit seed by calling the live API.
// Writes src/lib/self-audit-seed.ts with fs + JSON.stringify as UTF-8.
// Usage: node scripts/regenerate-seed.mjs

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(REPO_ROOT, "src/lib/self-audit-seed.ts");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function fetchSelfAudit() {
  const res = await fetch(`${BASE_URL}/api/self-audit`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`self-audit failed (${res.status}): ${text}`);
  }
  return res.json();
}

function escapeForTsString(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function generateSeedFile(data) {
  const claimsJson = JSON.stringify(data.claims, null, 2);
  return `import { SelfAuditResult } from "@/types";

// Captured from one real POST to /api/self-audit (Fix 6), regenerated after
// Fix 13 (latency instrumentation + prompt dedupe/cap) from a run against the pushed
// state of github.com/kathir-iTech/Vibe_Check (commit 49a15ab). self-2 stays TRUE on
// a genuine code line. self-1 and self-3 return UNVERIFIED: self-3's model quote
// came back backslash-escaped in the JSON, so the server-side quote re-verification
// (an existing rule) rejected it instead of displaying. Same verdict rules as before;
// the flip is model output variance, never tuned. Committed exactly as returned.
// This is the initial state so the homepage shows a real result on first load,
// not a spinner; "Re-run live" always re-fetches.
export const SELF_AUDIT_SEED: SelfAuditResult = ${claimsJson};
`;
}

async function main() {
  console.log(`[regenerate-seed] Fetching from ${BASE_URL}/api/self-audit...`);
  const data = await fetchSelfAudit();
  console.log(`[regenerate-seed] Got result with ${data.claims?.length ?? 0} claims`);
  
  const fileContent = generateSeedFile(data);
  writeFileSync(SEED_PATH, fileContent, "utf8");
  console.log(`[regenerate-seed] Wrote ${SEED_PATH}`);
  
  // Verify em dash renders correctly
  for (const claim of data.claims) {
    if (claim.text.includes("\u2014")) {
      console.log(`[regenerate-seed] ✓ Em dash found in claim ${claim.id}`);
    }
  }
}

main().catch((err) => {
  console.error("[regenerate-seed] Error:", err.message);
  process.exit(1);
});