import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

async function githubApi(url: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeCheck",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return response.json();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = body.claims || [];
  const evidence = body.evidence || {};

  if (!repoUrl || !claims.length) {
    return NextResponse.json({ drift: [] });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ drift: [], error: "Invalid GitHub URL" });
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const driftFlags: any[] = [];

  try {
    const [scopeDoc, prdDoc, specDoc] = await Promise.all([
      githubApi(`/repos/${owner}/${cleanRepo}/contents/devpost/scope.md`).catch(() => null),
      githubApi(`/repos/${owner}/${cleanRepo}/contents/devpost/prd.md`).catch(() => null),
      githubApi(`/repos/${owner}/${cleanRepo}/contents/devpost/spec.md`).catch(() => null),
    ]);

    const specContent = scopeDoc
      ? Buffer.from(scopeDoc.content, "base64").toString()
      : "";
    const prdContent = prdDoc
      ? Buffer.from(prdDoc.content, "base64").toString()
      : "";
    const specContent2 = specDoc
      ? Buffer.from(specDoc.content, "base64").toString()
      : "";

    const allSpecText = `${specContent}\n${prdContent}\n${specContent2}`;
    const specKeywords = extractKeywords(allSpecText);

    for (const claim of claims) {
      const claimText = claim.text || claim;
      const claimWords = claimText.toLowerCase().split(/\s+/);
      const evidenceFiles = evidence[claim.id || claimText]?.files || [];
      const hasEvidence = evidenceFiles.length > 0;

      if (!hasEvidence) {
        driftFlags.push({
          claimId: claim.id || claimText,
          claimText,
          verdict: "SPEC-DRIFT",
          reason: "Claim references a feature not found in repo evidence and no supporting spec files match",
          specReference: "No matching files found",
        });
      } else if (specKeywords.length > 0) {
        const claimLower = claimText.toLowerCase();
        const matchesSpec = specKeywords.some((kw: string) =>
          claimLower.includes(kw.toLowerCase())
        );
        if (!matchesSpec) {
          driftFlags.push({
            claimId: claim.id || claimText,
            claimText,
            verdict: "SPEC-DRIFT",
            reason: "Claim appears to contradict repository spec files",
            specReference: "Checked against devpost/scope.md, devpost/prd.md, devpost/spec.md",
          });
        }
      }
    }
  } catch {
    driftFlags.push({
      claimId: "error",
      claimText: "spec-drift-check",
      verdict: "SPEC-DRIFT",
      reason: "Could not fetch spec files from repo",
      specReference: "N/A",
    });
  }

  return NextResponse.json({ drift: driftFlags });
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const sections = text.split(/##+/);
  for (const section of sections) {
    const words = section.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    for (const w of words) {
      if (!keywords.includes(w) && !["this", "that", "they", "have", "been", "will", "from", "with", "what", "when", "where", "how", "than", "over", "been"].includes(w)) {
        if (keywords.length < 20) keywords.push(w);
      }
    }
  }
  return keywords;
}

export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get("repoUrl") || "";
  const claimsParam = request.nextUrl.searchParams.get("claims") || "";
  const claims = claimsParam ? JSON.parse(claimsParam) : [];
  const evidence = {};
  const result = await POST(Object.assign(request, { json: () => Promise.resolve({ repoUrl, claims, evidence }) }));
  return result;
}
