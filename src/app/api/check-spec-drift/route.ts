import { NextRequest, NextResponse } from "next/server";
import { fetchFileContentsForClaims, githubApi, parseGitHubRepoUrl } from "@/lib/github";
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

async function fetchDoc(base: string, file: string, userToken?: string): Promise<string | null> {
  try {
    const data = await githubApi(`${base}/contents/${file}`, 8000, userToken);
    return Buffer.from(data.content, "base64").toString();
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
      { status: 400 }
    );
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const rawClaims = Array.isArray(body?.claims) ? body.claims.slice(0, MAX_CLAIMS) : [];
  const evidence = body?.evidence && typeof body.evidence === "object" ? body.evidence : {};
  const userToken = request.headers?.get?.("x-github-token") || undefined;

  if (!repoUrl) {
    return NextResponse.json(
      { drift: [], error: "repoUrl required", model: null },
      { status: 400 }
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
      { status: 400 }
    );
  }

  const { owner, repo: cleanRepo } = parsedRepo;
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  let docs: SpecDoc[];
  try {
    const [scopeContent, prdContent, specContent] = await Promise.all([
      fetchDoc(base, "devpost/scope.md", userToken),
      fetchDoc(base, "devpost/prd.md", userToken),
      fetchDoc(base, "devpost/spec.md", userToken),
    ]);
    docs = [
      { file: "devpost/scope.md", text: scopeContent || "" },
      { file: "devpost/prd.md", text: prdContent || "" },
      { file: "devpost/spec.md", text: specContent || "" },
    ].filter((d) => d.text.trim().length > 0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { drift: [], error: `Could not fetch spec documents: ${msg}`, model: null },
      { status: 502 }
    );
  }

  const outcomes = new Map<string, any>();
  const toAssess: { id: string; text: string }[] = [];
  timings.lap("specDocFetch");

  for (const claim of rawClaims) {
    const claimText = String(claim?.text || claim || "").slice(0, MAX_CLAIM_CHARS);
    const claimId = String(claim?.id || claimText);
    if (hasRealEvidence(evidence[claimId])) {
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
      filesByClaim[c.id] = Array.isArray(entry?.files) ? entry.files.slice(0, 5) : [];
    }
    try {
      supportFiles = await fetchFileContentsForClaims(base, filesByClaim, userToken);
    } catch {
      supportFiles = {};
    }
  }

  const hasSupport = toAssess.some((c) => (supportFiles[c.id] || []).length > 0);
  timings.lap("supportFileFetch");

  if (toAssess.length && !docs.length && !hasSupport) {
    for (const c of toAssess) {
      outcomes.set(c.id, {
        claimId: c.id,
        claimText: c.text,
        verdict: "UNVERIFIED",
        reason: "No planning documents and no readable matched files to verify this claim against",
        specReference: "",
      });
    }
  } else if (toAssess.length) {
    let answer;
    try {
      answer = await assessClaimsAgainstSpec(toAssess, docs, supportFiles, GEMINI_API_KEY);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { drift: [], error: `Gemini API error: ${msg}`, model: null, modelFallback: false },
        { status: 502 }
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
      if (a.contradicts) {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: "SPEC-DRIFT",
          reason: a.reason,
          specReference: `${a.sourceDoc}:${a.lineNumber}: ${a.contradictingLine}`,
        });
      } else if (a.supported && a.supportingLine > 0) {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: "TRUE",
          reason: a.reason,
          specReference: `${a.supportingFile}:${a.supportingLine}: ${a.supportingQuote}`,
        });
      } else {
        outcomes.set(a.claimId, {
          claimId: a.claimId,
          claimText,
          verdict: "UNVERIFIED",
          reason: a.rejectionReason || "No verified supporting line found in the matched files.",
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
    { drift, model, modelFallback, usage, timings: finalTimings },
    { headers: { "Server-Timing": serverTimingHeader(finalTimings) } }
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
