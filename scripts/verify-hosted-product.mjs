import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { canonicalJSON, unsignedReport } from "../src/lib/report-format.mjs";

const [origin, revision, name] = process.argv.slice(2);
const url = new URL(origin);
if (
  url.origin !== origin ||
  url.protocol !== "https:" ||
  !url.hostname.startsWith("vibe-check-") ||
  !url.hostname.endsWith(".vercel.app") ||
  !/^[a-f0-9]{40}$/.test(revision || "") ||
  !/^[a-z0-9-]{1,48}$/.test(name || "")
)
  throw new Error(
    "Supply the intended VibeCheck HTTPS origin, full deployed revision and new observation name.",
  );
const target = `artifacts/${name}.json`;
if (existsSync(target)) throw new Error("Observation exists; preserve it.");
async function request(path, body) {
  if (process.env.VIBECHECK_AUTH_CLI) {
    mkdirSync("artifacts", { recursive: true });
    const args = [
      process.env.VIBECHECK_AUTH_CLI,
      "curl",
      path,
      "--deployment",
      origin,
      "--scope",
      "kathirs-projects-0d1795d0",
      "--",
      "--silent",
      "--show-error",
      "--fail-with-body",
      "--max-time",
      "120",
      "--write-out",
      "\nVIBECHECK_HTTP:%{http_code}",
    ];
    if (body) {
      writeFileSync("artifacts/hosted-request.json", JSON.stringify(body));
      args.push(
        "--request",
        "POST",
        "--header",
        "Content-Type: application/json",
        "--data-binary",
        "@artifacts/hosted-request.json",
      );
    }
    let raw;
    try {
      raw = execFileSync(process.execPath, args, {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw new Error(`Authenticated staged request failed: ${path}`);
    }
    const marker = "\nVIBECHECK_HTTP:";
    const at = raw.lastIndexOf(marker);
    if (at < 0)
      throw new Error("Authenticated request returned no HTTP status.");
    return new Response(raw.slice(0, at), {
      status: Number(raw.slice(at + marker.length)),
    });
  }
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
}
async function json(path, body) {
  const response = await request(path, body);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const health = await json("/api/health");
assert.equal(health.sourceHead, revision);
assert.equal(health.verifierVersion, "2.2.0");
assert.equal(health.signingConfigured, true);
const root = await request("/");
assert.equal(root.status, 200);
assert.match(await root.text(), /AI says done/);
const proof = await request("/proof");
assert.equal(proof.status, 200);
const started = performance.now();
const result = await json("/api/audit", {
  repoUrl: "https://github.com/chalk/chalk",
  headSha: "47fc05abd46171b235e24174cd2dba83d25bf037",
  claims: [{ id: "execution", text: "All tests passed" }],
});
assert.ok(result.auditReceipt);
assert.equal(result.audit.verdicts[0].verdict, "UNVERIFIED");
assert.equal(result.audit.models.assessment.model, null);
assert.equal(result.audit.verifierVersion, "2.2.0");
const key = await json("/api/report-key");
const publicKey = createPublicKey({
  key: Buffer.from(key.publicKey, "base64"),
  format: "der",
  type: "spki",
});
assert.equal(
  verify(
    null,
    Buffer.from(canonicalJSON(unsignedReport(result.audit))),
    publicKey,
    Buffer.from(result.audit.sig, "base64url"),
  ),
  true,
);
const shared = await json("/api/generate-report", {
  auditReceipt: result.auditReceipt,
});
assert.ok(shared.permalink.startsWith(origin + "/report/view#"));
assert.equal((await request("/report/view")).status, 200);
const record = {
  scope:
    "Actual hosted HTTP -> GitHub -> deterministic execution-evidence boundary -> signed report -> independent Node Ed25519 verification -> share endpoint. This intentionally makes no model calls and does not establish model availability or semantic accuracy. Configuration health is distinct from provider readiness.",
  observedAt: new Date().toISOString(),
  origin,
  health,
  rootStatus: root.status,
  proofStatus: proof.status,
  signatureVerified: true,
  shareEndpointVerified: true,
  durationMs: Math.round(performance.now() - started),
  audit: result.audit,
  verificationKey: key,
  permalink: shared.permalink,
};
mkdirSync("artifacts", { recursive: true });
writeFileSync(target, JSON.stringify(record, null, 2) + "\n");
console.log(
  JSON.stringify({
    origin,
    revision,
    rootStatus: 200,
    proofStatus: 200,
    auditStatus: 200,
    verdict: result.audit.verdicts[0].verdict,
    signatureVerified: true,
    shareEndpointVerified: true,
    modelCalls: 0,
    durationMs: record.durationMs,
  }),
);
