#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createPublicKey, verify } from "node:crypto";
import {
  canonicalJSON,
  unsignedReport,
  validReportShape,
} from "../src/lib/report-format.mjs";
const [reportFile, keyFile] = process.argv.slice(2);
if (!reportFile || !keyFile) {
  console.error(
    "Usage: node scripts/verify-report.mjs report.json trusted-key.json\nObtain and pin trusted-key.json separately from the service /api/report-key endpoint.",
  );
  process.exit(2);
}
try {
  const report = JSON.parse(readFileSync(reportFile, "utf8"));
  const key = JSON.parse(readFileSync(keyFile, "utf8"));
  if (
    !validReportShape(report) ||
    report.schema !== "vibecheck/audit/v2" ||
    report.keyId !== key.keyId ||
    key.algorithm !== "Ed25519"
  )
    throw new Error("Report shape, schema or trusted key identity mismatch");
  const valid = verify(
    null,
    Buffer.from(canonicalJSON(unsignedReport(report))),
    createPublicKey({
      key: Buffer.from(key.publicKey, "base64"),
      format: "der",
      type: "spki",
    }),
    Buffer.from(report.sig, "base64url"),
  );
  if (!valid) throw new Error("Signature verification failed");
  console.log(
    JSON.stringify(
      {
        signatureVerified: true,
        repoUrl: report.repoUrl,
        headSha: report.headSha,
        claims: report.claims.length,
        scope:
          "Report integrity and service provenance only; source conclusions and runtime correctness need independent review.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
