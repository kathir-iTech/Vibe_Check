import { NextRequest, NextResponse } from "next/server";
import { githubApi } from "@/lib/github";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};

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
      githubApi(`${base}/contents/devpost/scope.md`).catch(() => null),
      githubApi(`${base}/contents/devpost/prd.md`).catch(() => null),
      githubApi(`${base}/contents/devpost/spec.md`).catch(() => null),
    ]);

    const scopeContent = scopeDoc
      ? Buffer.from(scopeDoc.content, "base64").toString()
      : "";
    const prdContent = prdDoc
      ? Buffer.from(prdDoc.content, "base64").toString()
      : "";
    const specContent = specDoc
      ? Buffer.from(specDoc.content, "base64").toString()
      : "";

    const allSpecText = `${scopeContent}\n${prdContent}\n${specContent}`;
    const specKeywords = extractKeywords(allSpecText);

    for (const claim of claims) {
      const claimText = claim.text || claim;
      const claimId = claim.id || claimText;
      const evidenceFiles = evidence[claimId]?.files || [];
      const hasEvidence = evidenceFiles.length > 0;

      if (!hasEvidence) {
        driftFlags.push({
          claimId,
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
            claimId,
            claimText,
            verdict: "SPEC-DRIFT",
            reason: "Claim appears to contradict repository spec files",
            specReference: "Checked against devpost/scope.md, devpost/prd.md, devpost/spec.md",
          });
        }
      }
    }
  } catch (error) {
    driftFlags.push({
      claimId: "error",
      claimText: "spec-drift-check",
      verdict: "SPEC-DRIFT",
      reason: `Could not fetch spec files from repo: ${error instanceof Error ? error.message : String(error)}`,
      specReference: "N/A",
    });
  }

  return NextResponse.json({ drift: driftFlags });
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const stopWords = new Set(["this", "that", "they", "have", "been", "will", "from", "with", "what", "when", "where", "how", "than", "over", "been", "their", "there", "would", "could", "should", "about", "into", "more", "some", "such"]);
  const sections = text.split(/##+/);
  for (const section of sections) {
    const words = section.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    for (const w of words) {
      if (!keywords.includes(w) && !stopWords.has(w)) {
        if (keywords.length < 20) keywords.push(w);
      }
    }
  }
  return keywords;
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
