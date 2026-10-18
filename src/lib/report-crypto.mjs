import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonicalJSON, REPORT_SCHEMA, unsignedReport, validReportShape } from "./report-format.mjs";

function getSigningSecret() {
  const value = process.env.REPORT_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("Report signing is not configured. Set a dedicated REPORT_SIGNING_SECRET of at least 32 characters.");
  return value;
}

function privateKey() {
  const seed = createHash('sha256').update(getSigningSecret()).digest();
  return createPrivateKey({key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'), seed]),format:'der',type:'pkcs8'});
}
export function reportVerificationKey() {
  const publicKey = createPublicKey(privateKey()).export({format:'der',type:'spki'}).toString('base64');
  return {algorithm:'Ed25519',keyId:createHash('sha256').update(publicKey).digest('hex').slice(0,16),publicKey};
}

export function parseGitHubRepoUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("repoUrl required");
  }
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(withProto);
  } catch {
    throw new Error("Invalid GitHub URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Invalid GitHub URL protocol");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new Error("Invalid GitHub URL: hostname must be github.com");
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new Error("Invalid GitHub URL: unexpected credentials or port");
  }
  const parts = parsed.pathname
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid GitHub URL: expected github.com/{owner}/{repo}");
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (
    !/^[a-zA-Z0-9._-]+$/.test(owner) ||
    !/^[a-zA-Z0-9._-]+$/.test(repo) ||
    owner === "." ||
    owner === ".." ||
    repo === "." ||
    repo === ".."
  ) {
    throw new Error("Invalid GitHub owner or repository name");
  }
  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

function canonicalReportDigestInput(payload) {
  return canonicalJSON(unsignedReport(payload));
}

export function signReportPayload(payload) {
  return sign(null, Buffer.from(canonicalReportDigestInput(payload)), privateKey()).toString('base64url');
}

export function verifyReportSignature(payload, signature) {
  if (!signature || typeof signature !== "string") return false;
  try {
    const key = reportVerificationKey();
    if (payload.schema !== REPORT_SCHEMA || payload.keyId !== key.keyId) return false;
    return verify(null, Buffer.from(canonicalReportDigestInput(payload)), createPublicKey(privateKey()), Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

export function encodeSignedReport(payload) {
  const unsigned = { verifierVersion:'2.0.0',source:{kind:'live',label:'Server assessment'},requirements:[],sourceDocuments:[],models:{},timings:{},warnings:[],retrieval:{totalFiles:0,candidateFiles:0,inspectedFiles:0,omittedFiles:0,bounded:true,treeTruncated:false},...unsignedReport(payload), schema: REPORT_SCHEMA, keyId: reportVerificationKey().keyId };
  if (!validReportShape(unsigned)) throw new Error('Invalid audit report');
  const sig = signReportPayload(unsigned);
  const signedPayload = { ...unsigned, sig };
  return {
    id: Buffer.from(JSON.stringify(signedPayload), "utf8").toString("base64url"),
    sig,
    signedPayload,
  };
}

export function safeDecodeReportId(idParam) {
  try {
    if (!idParam || typeof idParam !== "string" || idParam.length > 256 * 1024) {
      return null;
    }
    const json = Buffer.from(idParam, "base64url").toString("utf8");
    const data = JSON.parse(json);
    if (!validReportShape(data)) {
      return null;
    }
    const report = { ...data, signatureVerified: false };
    report.signatureVerified = verifyReportSignature(report, report.sig);
    return report;
  } catch {
    return null;
  }
}
