import test from "node:test";
import assert from "node:assert/strict";
import { verify, createPublicKey } from "node:crypto";
import {
  encodeSignedReport,
  safeDecodeReportId,
  reportVerificationKey,
} from "../src/lib/report-crypto.mjs";
import {
  canonicalJSON,
  unsignedReport,
  validReportShape,
} from "../src/lib/report-format.mjs";
import { loadProduction } from "../scripts/test-support.mjs";
process.env.REPORT_SIGNING_SECRET = "test-only-dedicated-secret-32-chars-long";
const payload = {
  repoUrl: "https://github.com/acme/app",
  headSha: "a".repeat(40),
  claims: [{ id: "c1", text: "Login function exists" }],
  evidence: { c1: { files: ["auth.ts"] } },
  verdicts: [
    {
      claimId: "c1",
      verdict: "TRUE",
      reason: "real",
      supportingQuote: "export function login(){}",
    },
  ],
  source: { kind: "live", label: "Test fixture" },
  generatedAt: "2026-10-18T00:00:00Z",
};
const idOf = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

test("report imports reject malformed fields consumed by the workspace views", () => {
  const { EXAMPLE_AUDIT } = loadProduction("src/lib/example-audit.ts");
  assert.equal(validReportShape(EXAMPLE_AUDIT), true);
  const fixture = structuredClone(EXAMPLE_AUDIT);
  fixture.requirements = [
    {
      id: "r1",
      text: "Must preserve login",
      file: "scope.md",
      line: 1,
      status: "not-mentioned",
      claimIds: [],
    },
  ];
  for (const mutate of [
    (p) => delete p.headSha,
    (p) => (p.generatedAt = "invalid"),
    (p) => (p.retrieval.fileHints = "not an array"),
    (p) => (p.requirements[0].strength = { malformed: true }),
    (p) => (p.requirements[0].suggestedClaimIds = "not an array"),
    (p) => (p.requirements[0].claimIds = [{ malformed: true }]),
    (p) =>
      (p.models.assessment = {
        usage: { promptTokenCount: { toLocaleString: true } },
      }),
  ]) {
    const changed = structuredClone(fixture);
    mutate(changed);
    assert.equal(validReportShape(changed), false);
  }
});
test("every displayed report field is signed and signature verifies with an independent public key", () => {
  const { id, signedPayload } = encodeSignedReport(payload);
  assert.equal(safeDecodeReportId(id).signatureVerified, true);
  const key = reportVerificationKey();
  assert.equal(
    verify(
      null,
      Buffer.from(canonicalJSON(unsignedReport(signedPayload))),
      createPublicKey({
        key: Buffer.from(key.publicKey, "base64"),
        format: "der",
        type: "spki",
      }),
      Buffer.from(signedPayload.sig, "base64url"),
    ),
    true,
  );
  for (const mutate of [
    (p) => p.evidence.c1.files.push("invented.ts"),
    (p) => (p.verdicts[0].reason = "invented"),
    (p) => (p.verdicts[0].supportingQuote = "invented"),
    (p) => (p.source.kind = "demo"),
    (p) => (p.headSha = "b".repeat(40)),
  ]) {
    const changed = structuredClone(signedPayload);
    mutate(changed);
    assert.equal(safeDecodeReportId(idOf(changed)).signatureVerified, false);
  }
});
test("actual report route refuses invented client verdicts and accepts only an actual receipt", async () => {
  const { POST } = loadProduction("src/app/api/generate-report/route.ts");
  const request = (body) => ({
    json: async () => body,
    nextUrl: new URL("http://localhost:3000/api/generate-report"),
  });
  assert.equal((await POST(request(payload))).status, 422);
  const { id } = encodeSignedReport(payload);
  const valid = await POST(request({ auditReceipt: id }));
  assert.equal(valid.status, 200);
  assert.match((await valid.json()).permalink, /report\/view#/);
  const demo = encodeSignedReport({
    ...payload,
    source: { kind: "demo", label: "Test example" },
  });
  assert.equal((await POST(request({ auditReceipt: demo.id }))).status, 422);
});
test("missing dedicated signing secret never falls back to provider credentials", () => {
  const saved = process.env.REPORT_SIGNING_SECRET;
  delete process.env.REPORT_SIGNING_SECRET;
  try {
    assert.throws(() => encodeSignedReport(payload), /not configured/);
  } finally {
    process.env.REPORT_SIGNING_SECRET = saved;
  }
});
