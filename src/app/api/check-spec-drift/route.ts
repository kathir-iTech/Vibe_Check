import { NextRequest, NextResponse } from "next/server";
import { fetchFileContentsForClaims, githubApi } from "@/lib/github";
import { assessClaimsAgainstSpec, GeminiUsage, SpecDoc } from "@/lib/gemini";
import { createTimings, serverTimingHeader } from "@/lib/timings";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const maxDuration = 60;

async function fetchDoc(base: string, file: string): Promise<string | null> {
  try {
    const data = await githubApi(`${base}/contents/${file}`);
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
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};

  if (!repoUrl) {
    return NextResponse.json(
      { drift: [], error: "repoUrl required", model: null },
      { status: 400 }
    );
  }
  if (!claims.length) {
    return NextResponse.json({ drift: [], model: null });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json(
      { drift: [], error: "Invalid GitHub URL", model: null },
      { status: 400 }
    );
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  let docs: SpecDoc[];
  try {
    const [scopeContent, prdContent, specContent] = await Promise.all([
      fetchDoc(base, "devpost/scope.md"),
      fetchDoc(base, "devpost/prd.md"),
      fetchDoc(base, "devpost/spec.md"),
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

  for (const claim of claims) {
    const claimText = claim.text || claim;
    const claimId = claim.id || claimText;
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
      filesByClaim[c.id] = Array.isArray(entry?.files) ? entry.files : [];
    }
    try {
      supportFiles = await fetchFileContentsForClaims(base, filesByClaim);
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

  const drift = claims.map((claim: any) => {
    const claimId = claim.id || claim.text;
    return (
      outcomes.get(claimId) || {
        claimId,
        claimText: claim.text || claim,
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
  } as unknown as NextRequest;
  return POST(fakeRequest);
}
