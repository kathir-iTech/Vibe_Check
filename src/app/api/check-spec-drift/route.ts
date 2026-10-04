import { NextRequest, NextResponse } from "next/server";
import { githubApi } from "@/lib/github";
import { assessClaimsAgainstSpec, SpecDoc } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};

  if (!repoUrl) {
    return NextResponse.json({ drift: [], error: "repoUrl required" }, { status: 400 });
  }
  if (!claims.length) {
    return NextResponse.json({ drift: [] });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ drift: [], error: "Invalid GitHub URL" }, { status: 400 });
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
      { drift: [], error: `Could not fetch spec documents: ${msg}` },
      { status: 502 }
    );
  }

  const outcomes = new Map<string, any>();
  const toAssess: { id: string; text: string }[] = [];

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

  if (toAssess.length && !docs.length) {
    for (const c of toAssess) {
      outcomes.set(c.id, {
        claimId: c.id,
        claimText: c.text,
        verdict: "TRUE",
        reason: "Evidence found in repo; no spec documents available to contradict it",
        specReference: "",
      });
    }
  } else if (toAssess.length) {
    let assessments;
    try {
      assessments = await assessClaimsAgainstSpec(toAssess, docs, GEMINI_API_KEY);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { drift: [], error: `Gemini API error: ${msg}` },
        { status: 502 }
      );
    }
    for (const a of assessments) {
      const claim = toAssess.find((c) => c.id === a.claimId);
      outcomes.set(a.claimId, {
        claimId: a.claimId,
        claimText: claim?.text || a.claimId,
        verdict: a.contradicts ? "SPEC-DRIFT" : "TRUE",
        reason: a.reason,
        specReference: a.contradicts
          ? `${a.sourceDoc}:${a.lineNumber}: ${a.contradictingLine}`
          : "",
      });
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

  return NextResponse.json({ drift });
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
