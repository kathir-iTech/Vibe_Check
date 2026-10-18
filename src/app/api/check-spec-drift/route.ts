import { NextRequest, NextResponse } from "next/server";
import {
  fetchFileContentsForClaims,
  githubApi,
  parseGitHubRepoUrl,
  resolveSnapshot,
  safeRepoPath,
} from "@/lib/github";
import {
  evidenceObligation,
  nextEvidence,
  RUNTIME_EVIDENCE_REASON,
  validateAuditClaims,
} from "@/lib/audit-policy.mjs";
import { evidenceContract } from "@/lib/evidence-depth.mjs";
import {
  assessClaimsAgainstSpec,
  GeminiUsage,
  MAX_CLAIMS,
  MAX_CLAIM_CHARS,
  SpecDoc,
} from "@/lib/gemini";
import { createTimings, serverTimingHeader } from "@/lib/timings";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const maxDuration = 60;

async function fetchDoc(
  base: string,
  file: string,
  userToken?: string,
  ref?: string,
): Promise<string | null> {
  try {
    const data = await githubApi(
      `${base}/contents/${safeRepoPath(file)}?ref=${ref}`,
      8000,
      userToken,
    );
    return Buffer.from(data.content, "base64")
      .toString()
      .slice(0, 20 * 1024);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/GitHub API error: 404\b/.test(msg)) return null;
    throw error;
  }
}

function hasRealEvidence(entry: any): boolean {
  if (!entry || typeof entry !== "object") return false;
  const files = Array.isArray(entry.files) ? entry.files : [];
  const commits = Array.isArray(entry.commits) ? entry.commits : [];
  return files.length > 0 || commits.length > 0;
}

export async function POST(request: NextRequest) {
  const timings = createTimings();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { drift: [], error: "Invalid JSON body", model: null },
      { status: 400 },
    );
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  let rawClaims: { id: string; text: string }[];
  try {
    rawClaims = validateAuditClaims(body?.claims);
  } catch (error) {
    return NextResponse.json(
      { error: String(error), drift: [] },
      { status: 400 },
    );
  }
  const evidence =
    body?.evidence && typeof body.evidence === "object" ? body.evidence : {};
  const userToken = request.headers?.get?.("x-github-token") || undefined;

  if (!repoUrl) {
    return NextResponse.json(
      { drift: [], error: "repoUrl required", model: null },
      { status: 400 },
    );
  }
  if (!rawClaims.length) {
    return NextResponse.json({ drift: [], model: null });
  }

  let parsedRepo: { owner: string; repo: string; canonicalUrl: string };
  try {
    parsedRepo = parseGitHubRepoUrl(repoUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid GitHub URL";
    return NextResponse.json(
      { drift: [], error: msg, model: null },
      { status: 400 },
    );
  }

  const { owner, repo: cleanRepo } = parsedRepo;
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  let docs: SpecDoc[];
  let headSha: string;
  try {
    const inheritedSha =
      body.headSha ||
      Object.values(evidence)
        .map((e: any) => e?.headSha)
        .find(Boolean) ||
      "";
    headSha = (await resolveSnapshot(repoUrl, inheritedSha, userToken)).headSha;
    if (
      Object.values(evidence).some(
        (e: any) => e?.headSha && e.headSha !== headSha,
      )
    )
      throw new Error("Evidence snapshot mismatch");
    const paths = Array.isArray(body.planningFiles)
      ? body.planningFiles
          .filter(
            (p: unknown) =>
              typeof p === "string" &&
              /^(?:devpost\/|docs\/)?(?:scope|prd|spec)\.md$/i.test(p),
          )
          .slice(0, 6)
      : [
          "devpost/scope.md",
          "devpost/prd.md",
          "devpost/spec.md",
          "scope.md",
          "prd.md",
          "spec.md",
        ];
    docs = (
      await Promise.all(
        paths.map(async (file: string) => ({
          file,
          text: (await fetchDoc(base, file, userToken, headSha)) || "",
        })),
      )
    ).filter((d) => d.text.trim());
    if (
      body.requirements != null &&
      (typeof body.requirements !== "string" || body.requirements.length > 3000)
    )
      throw new Error("Review requirements must be at most 3000 characters");
    if (typeof body.requirements === "string" && body.requirements.trim())
      docs.unshift({
        file: "provided-requirements.md",
        provided: true,
        text: body.requirements
          .split("\n")
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => `- ${line.replace(/^[-*]\s*/, "")}`)
          .join("\n"),
      });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        drift: [],
        error: `Could not fetch spec documents: ${msg}`,
        model: null,
      },
      { status: 502 },
    );
  }

  const outcomes = new Map<string, any>();
  const toAssess: { id: string; text: string }[] = [];
  timings.lap("specDocFetch");

  for (const claim of rawClaims) {
    const claimText = String(claim?.text || claim || "").slice(
      0,
      MAX_CLAIM_CHARS,
    );
    const claimId = String(claim?.id || claimText);
    if (["execution", "runtime"].includes(evidenceObligation(claimText))) {
      outcomes.set(claimId, {
        claimId,
        claimText,
        verdict: "UNVERIFIED",
        reason: RUNTIME_EVIDENCE_REASON,
        specReference: "",
        obligation: evidenceObligation(claimText),
      });
    } else if (hasRealEvidence(evidence[claimId])) {
      toAssess.push({ id: claimId, text: claimText });
    } else {
      outcomes.set(claimId, {
        claimId,
        claimText,
        verdict: "UNVERIFIED",
        reason: "No matching files or commits found in repo evidence",
        specReference: "",
      });
    }
  }

  let model: string | null = null;
  let modelFallback = false;
  let usage: GeminiUsage | null = null;

  let supportFiles: Record<string, SpecDoc[]> = {};
  if (toAssess.length) {
    const filesByClaim: Record<string, string[]> = {};
    for (const c of toAssess) {
      const entry = evidence[c.id];
      filesByClaim[c.id] = Array.isArray(entry?.files)
        ? entry.files.slice(0, 8)
        : [];
    }
    try {
      supportFiles = await fetchFileContentsForClaims(
        base,
        filesByClaim,
        userToken,
        headSha,
        Object.fromEntries(toAssess.map((c) => [c.id, c.text])),
      );
    } catch {
      supportFiles = {};
    }
  }

  const hasSupport = toAssess.some(
    (c) => (supportFiles[c.id] || []).length > 0,
  );
  timings.lap("supportFileFetch");

  if (toAssess.length && !docs.length && !hasSupport) {
    for (const c of toAssess) {
      outcomes.set(c.id, {
        claimId: c.id,
        claimText: c.text,
        verdict: "UNVERIFIED",
        reason:
          "No planning documents and no readable matched files to verify this claim against",
        specReference: "",
      });
    }
  } else if (toAssess.length) {
    let answer;
    try {
      answer = await assessClaimsAgainstSpec(
        toAssess,
        docs,
        supportFiles,
        GEMINI_API_KEY,
        request.signal,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        {
          drift: [],
          error: `Gemini API error: ${msg}`,
          model: null,
          modelFallback: false,
        },
        { status: 502 },
      );
    }
    model = answer.model;
    modelFallback = answer.modelFallback;
    usage = answer.usage || null;
    if (answer.timings) {
      timings.set("gemini", answer.timings.gemini || 0);
      timings.set("validation", answer.timings.validation || 0);
    }
    for (const a of answer.data) {
      const claim = toAssess.find((c) => c.id === a.claimId);
      const claimText = claim?.text || a.claimId;
      if (
        a.contradicts &&
        a.supported &&
        a.supportingLine > 0 &&
        a.coverage === "full"
      ) {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: "SPEC-DRIFT",
          reason: a.reason,
          specReference: `${a.sourceDoc}:${a.lineNumber}: ${a.contradictingLine}`,
          supportingReference: `${a.supportingFile}:${a.supportingLine}: ${a.supportingQuote}`,
          code: {
            file: a.supportingFile,
            line: a.supportingLine,
            quote: a.supportingQuote,
          },
          spec: {
            file: a.sourceDoc,
            line: a.lineNumber,
            quote: a.contradictingLine,
          },
          sourceCheck: a.sourceCheck,
        });
      } else if (a.supported && a.supportingLine > 0) {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: a.coverage === "partial" ? "PARTIAL" : "TRUE",
          reason:
            a.sourceCheck?.ceiling === "partial"
              ? `${a.reason} ${a.sourceCheck.note}`
              : a.reason,
          specReference: `${a.supportingFile}:${a.supportingLine}: ${a.supportingQuote}`,
          code: {
            file: a.supportingFile,
            line: a.supportingLine,
            quote: a.supportingQuote,
          },
          sourceCheck: a.sourceCheck,
        });
      } else {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: "UNVERIFIED",
          reason:
            a.rejectionReason ||
            "No verified supporting line found in the matched files.",
          specReference: "",
        });
      }
    }
  }

  const drift = rawClaims.map((claim: any) => {
    const claimId = String(claim?.id || claim?.text || claim);
    return (
      outcomes.get(claimId) || {
        claimId,
        claimText: String(claim?.text || claim).slice(0, MAX_CLAIM_CHARS),
        verdict: "UNVERIFIED",
        reason: "No assessment produced",
        specReference: "",
      }
    );
  });

  const finalTimings = timings.finish();
  return NextResponse.json(
    {
      drift: drift.map((v: any) => {
        const finding = {
          ...v,
          obligation: evidenceObligation(v.claimText),
          nextEvidence: nextEvidence(v.claimText, v.verdict),
        };
        return { ...finding, contract: evidenceContract(finding) };
      }),
      headSha,
      docs,
      sourceWindows: Object.fromEntries(
        Object.entries(supportFiles).map(([id, files]) => [
          id,
          files.map((file) => ({
            file: file.file,
            startLine: file.startLine || 1,
            endLine: (file.startLine || 1) + file.text.split("\n").length - 1,
            truncated: Boolean((file as any).truncated),
          })),
        ]),
      ),
      model,
      modelFallback,
      usage,
      timings: finalTimings,
    },
    { headers: { "Server-Timing": serverTimingHeader(finalTimings) } },
  );
}

export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get("repoUrl") || "";
  const claimsParam = request.nextUrl.searchParams.get("claims") || "[]";
  let claims: any[] = [];
  try {
    claims = JSON.parse(claimsParam);
  } catch {
    claims = [];
  }
  const evidence = {};
  const fakeRequest = {
    json: () => Promise.resolve({ repoUrl, claims, evidence }),
    headers: request.headers,
  } as unknown as NextRequest;
  return POST(fakeRequest);
}
