import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as checkEvidence } from "@/app/api/check-evidence/route";
import { POST as checkDrift } from "@/app/api/check-spec-drift/route";
import { extractClaimsViaGemini } from "./gemini";
import {
  fetchClaimSource,
  githubApi,
  parseGitHubRepoUrl,
  resolveSnapshot,
} from "./github";
import {
  extractRequirements,
  mapRequirements,
  validateAuditClaims,
  VERIFIER_VERSION,
  nextEvidence,
} from "./audit-policy.mjs";
import { evidenceContract } from "./evidence-depth.mjs";
import { tokenize } from "./verification-guards.mjs";
import type { Audit, Finding } from "@/types/audit";

async function invoke(
  handler: (request: NextRequest) => Promise<Response>,
  body: unknown,
  headers: Headers,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const response = await handler({
    json: async () => body,
    headers,
    signal,
  } as NextRequest);
  const result = await response.json();
  if (!response.ok || result.error)
    throw new Error(result.error || `Audit stage failed (${response.status})`);
  return result;
}

export async function runAudit(
  input: any,
  headers: Headers,
  progress: (stage: string, checkpoint?: any) => void = () => {},
  signal?: AbortSignal,
): Promise<Audit> {
  const started = performance.now();
  const token = headers.get("x-github-token") || undefined;
  let repoUrl = String(input.repoUrl || "").trim();
  let requestedRef = String(input.headSha || "").trim();
  let baseSha = String(input.baseSha || "").trim();
  let message = String(input.message || "").trim();
  const models: Record<string, any> = {};
  const warnings: string[] = [];
  signal?.throwIfAborted();
  progress("source");
  if (input.sourceUrl) {
    const source = await fetchClaimSource(String(input.sourceUrl), token);
    if (
      repoUrl &&
      ![source.snapshot.repoUrl, source.targetRepoUrl].some(
        (url) =>
          url.toLowerCase() ===
          parseGitHubRepoUrl(repoUrl).canonicalUrl.toLowerCase(),
      )
    )
      throw new Error(
        "The claim source belongs to a different repository. Use its repository or clear the target.",
      );
    repoUrl = source.snapshot.repoUrl;
    requestedRef = source.snapshot.headSha;
    baseSha = source.baseSha || "";
    message = source.text;
  }
  const snapshot = await resolveSnapshot(repoUrl, requestedRef, token);
  if (baseSha && !/^[a-f0-9]{40}$/i.test(baseSha))
    throw new Error("Comparison base must be a full commit SHA");
  if (baseSha) await resolveSnapshot(snapshot.repoUrl, baseSha, token);
  progress("claims");
  let claims;
  if (input.claims) claims = validateAuditClaims(input.claims);
  else {
    if (!message || message.length > 8192)
      throw new Error("Provide an agent message between 1 and 8192 characters");
    const extraction = await extractClaimsViaGemini(
      message,
      process.env.GEMINI_API_KEY || "",
      signal,
    );
    claims = validateAuditClaims(extraction.data);
    models.extract = {
      model: extraction.model,
      fallback: extraction.modelFallback,
      usage: extraction.usage,
    };
  }
  const resolvedAt = performance.now();
  signal?.throwIfAborted();
  progress("claims-ready", {
    claims,
    repoUrl: snapshot.repoUrl,
    headSha: snapshot.headSha,
  });
  progress("evidence");
  const ev = await invoke(
    checkEvidence,
    {
      repoUrl: snapshot.repoUrl,
      headSha: snapshot.headSha,
      claims,
      fileHints: input.fileHints,
    },
    headers,
    signal,
  );
  if (ev.headSha !== snapshot.headSha)
    throw new Error("Evidence snapshot mismatch");
  const evidenceAt = performance.now();
  progress("assessment");
  const assessed = await invoke(
    checkDrift,
    {
      repoUrl: snapshot.repoUrl,
      headSha: snapshot.headSha,
      planningFiles: ev.planningFiles,
      requirements: input.requirements,
      claims,
      evidence: ev.evidence,
    },
    headers,
    signal,
  );
  if (assessed.headSha !== snapshot.headSha)
    throw new Error("Assessment snapshot mismatch");
  models.assessment = {
    model: assessed.model,
    fallback: assessed.modelFallback,
    usage: assessed.usage,
  };
  let verdicts: Finding[] = assessed.drift;
  for (const claim of claims) {
    if (ev.evidence[claim.id])
      ev.evidence[claim.id].sourceWindows =
        assessed.sourceWindows?.[claim.id] || [];
  }
  if (
    Object.values(assessed.sourceWindows || {}).some((rows: any) =>
      rows.some((row: any) => row.truncated),
    )
  )
    warnings.push(
      "Some source files were inspected in bounded windows. Citations retain original line numbers; omitted regions remain unassessed.",
    );
  if (baseSha) {
    try {
      const diff = await githubApi(
        `https://api.github.com/repos/${snapshot.owner}/${snapshot.repo}/compare/${baseSha}...${snapshot.headSha}`,
        8000,
        token,
      );
      if (diff.merge_base_commit?.sha !== baseSha)
        throw new Error(
          "The comparison base is not an ancestor of the inspected revision",
        );
      verdicts = verdicts.map((v) => {
        if (!v.code) return v;
        const changed = diff.files?.find(
          (file: any) => file.filename === v.code.file,
        );
        const added =
          changed?.patch
            ?.split("\n")
            .filter(
              (line: string) => line.startsWith("+") && !line.startsWith("+++"),
            )
            .map((line: string) => line.slice(1).trim()) || [];
        const observed = added.includes(v.code.quote.trim());
        const changeEvidence = observed
          ? "Supporting line appears in the compared additions"
          : "This added-line claim is not established by the bounded diff";
        const claimsNew =
          /\b(?:added|implemented|created|introduced|newly|built)\b/i.test(
            v.claimText,
          );
        return {
          ...v,
          changeEvidence,
          ...(claimsNew && !observed && v.verdict === "TRUE"
            ? {
                verdict: "PARTIAL" as const,
                reason:
                  "Source support exists, but this comparison does not establish that the cited implementation was newly added.",
              }
            : {}),
        };
      });
      if (diff.files?.length >= 300)
        warnings.push(
          "The GitHub comparison reached its file limit; change attribution is incomplete.",
        );
    } catch {
      warnings.push(
        "Comparison could not be retrieved. Source support does not establish when the feature was added.",
      );
    }
  } else if (
    claims.some((c) =>
      /\b(?:added|implemented|created|introduced)\b/i.test(c.text),
    )
  )
    warnings.push(
      "No comparison base selected. Source support establishes presence, not when a feature was added.",
    );
  let requirements = mapRequirements(
    extractRequirements(assessed.docs || []),
    claims,
    verdicts,
    tokenize,
  );
  if (!requirements.length)
    warnings.push(
      "No bounded requirements were extracted. Planning coverage needs human review.",
    );
  if (requirements.length === 32)
    warnings.push(
      "Requirement extraction reached its 32-item limit; additional requirements may be omitted.",
    );
  if (ev.retrieval.omittedFiles > 0 || ev.treeTruncated)
    warnings.push(
      "Retrieval is bounded. An uninspected file may contain additional evidence; UNVERIFIED does not mean false.",
    );
  const executionRecords = [];
  if (verdicts.some((v) => v.obligation === "execution")) {
    try {
      const checks = await githubApi(
        `https://api.github.com/repos/${snapshot.owner}/${snapshot.repo}/commits/${snapshot.headSha}/check-runs?per_page=20`,
        5000,
        token,
      );
      for (const check of checks.check_runs || []) {
        if (check.head_sha !== snapshot.headSha) {
          warnings.push(
            "A GitHub check with a missing or mismatched revision was excluded.",
          );
          continue;
        }
        executionRecords.push({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion || "pending",
          url: check.html_url,
          headSha: check.head_sha,
          completedAt: check.completed_at || null,
          claimIds: claims
            .filter(
              (c) =>
                c.text
                  .toLowerCase()
                  .includes(String(check.name).toLowerCase()) &&
                String(check.name).length >= 4,
            )
            .map((c) => c.id),
          note: "Provider-reported named check only; does not certify unspecified tests or complete functionality.",
        });
      }
    } catch {
      warnings.push(
        "CI check records were not accessible. Execution claims remain unverified.",
      );
    }
  }
  progress("report");
  signal?.throwIfAborted();
  verdicts = verdicts.map((finding) => {
    const updated = {
      ...finding,
      nextEvidence: nextEvidence(finding.claimText, finding.verdict),
    };
    return { ...updated, contract: evidenceContract(updated) };
  });
  return {
    verifierVersion: VERIFIER_VERSION,
    repoUrl: snapshot.repoUrl,
    headSha: snapshot.headSha,
    baseSha: baseSha || undefined,
    reviewContext: createHash("sha256")
      .update(
        JSON.stringify({
          provided: String(input.requirements || "").trim(),
          docs: (assessed.docs || []).map((d: any) => ({
            file: d.file,
            text: d.text,
          })),
        }),
      )
      .digest("hex"),
    generatedAt: new Date().toISOString(),
    claims,
    evidence: ev.evidence,
    verdicts,
    requirements,
    source: { kind: "live", label: "Server assessment of GitHub source" },
    retrieval: ev.retrieval,
    sourceDocuments: (assessed.docs || []).map((d: any) => ({
      file: d.file,
      sha256: createHash("sha256").update(d.text).digest("hex"),
      truncated: d.text.length >= 20 * 1024,
    })),
    models,
    timings: {
      sourceAndClaimsMs: Math.round(resolvedAt - started),
      evidenceMs: Math.round(evidenceAt - resolvedAt),
      assessmentMs: Math.round(performance.now() - evidenceAt),
      totalMs: Math.round(performance.now() - started),
    },
    warnings,
    executionRecords,
  };
}
