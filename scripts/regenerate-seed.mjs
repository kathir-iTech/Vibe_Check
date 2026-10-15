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

function generateSeedFile(data, repoUrl) {
  const claimsJson = JSON.stringify(data.claims, null, 2);
  return `import { SelfAuditResult } from "@/types";

// Captured from POST /api/self-audit against github.com/kathir-iTech/Vibe_Check.
// Initial state so the homepage renders verified self-audit data immediately with zero
// automatic API calls on page load; "Re-run live" triggers an on-demand check.
export const SELF_AUDIT_SEED: SelfAuditResult = {
  repoUrl: "${repoUrl}",
  runAt: "${data.runAt || new Date().toISOString()}",
  claims: ${claimsJson}
};
`;
}

async function main() {
  console.log(`[regenerate-seed] Fetching from ${BASE_URL}/api/self-audit...`);
  const data = await fetchSelfAudit();
  console.log(`[regenerate-seed] Got result with ${data.claims?.length ?? 0} claims`);

  const fileContent = generateSeedFile(data, "https://github.com/kathir-iTech/Vibe_Check");
  writeFileSync(SEED_PATH, fileContent, "utf8");
  console.log(`[regenerate-seed] Wrote ${SEED_PATH}`);

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