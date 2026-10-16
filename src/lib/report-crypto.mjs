import { createHmac, timingSafeEqual } from "crypto";

function getSigningSecret() {
  return (
    process.env.REPORT_SIGNING_SECRET ||
    process.env.GEMINI_API_KEY ||
    process.env.GITHUB_TOKEN ||
    "vibecheck-forensic-report-hmac-v1"
  );
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
  return JSON.stringify({
    repoUrl: payload.repoUrl || "",
    headSha: payload.headSha || "",
    generatedAt: payload.generatedAt || "",
    claims: (payload.claims || []).map((c) => ({ id: c.id, text: c.text })),
    verdicts: (payload.verdicts || []).map((v) => ({
      claimId: v.claimId,
      verdict: v.verdict,
      specReference: v.specReference || "",
    })),
  });
}

export function signReportPayload(payload) {
  const hmac = createHmac("sha256", getSigningSecret());
  hmac.update(canonicalReportDigestInput(payload));
  return hmac.digest("hex").slice(0, 32);
}

export function verifyReportSignature(payload, signature) {
  if (!signature || typeof signature !== "string") return false;
  const expected = signReportPayload(payload);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function encodeSignedReport(payload) {
  const sig = signReportPayload(payload);
  const signedPayload = { ...payload, sig };
  return {
    id: Buffer.from(JSON.stringify(signedPayload), "utf8").toString("base64url"),
    sig,
    signedPayload,
  };
}

export function safeDecodeReportId(idParam) {
  try {
    if (!idParam || typeof idParam !== "string" || idParam.length > 64 * 1024) {
      return null;
    }
    const json = Buffer.from(idParam, "base64url").toString("utf8");
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !Array.isArray(data.claims)) {
      return null;
    }
    const VALID_VERDICTS = new Set(["TRUE", "UNVERIFIED", "SPEC-DRIFT"]);
    const verdicts = Array.isArray(data.verdicts) ? data.verdicts : [];
    for (const v of verdicts) {
      if (!v || !VALID_VERDICTS.has(v.verdict)) {
        return null;
      }
    }
    const report = {
      repoUrl: typeof data.repoUrl === "string" ? data.repoUrl : "",
      headSha: typeof data.headSha === "string" ? data.headSha : "",
      claims: data.claims.slice(0, 15),
      evidence: data.evidence && typeof data.evidence === "object" ? data.evidence : {},
      verdicts: verdicts.slice(0, 15),
      generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
      sig: typeof data.sig === "string" ? data.sig : "",
      signatureVerified: false,
    };
    report.signatureVerified = verifyReportSignature(report, report.sig);
    return report;
  } catch {
    return null;
  }
}
