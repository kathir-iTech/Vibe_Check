import { NextRequest, NextResponse } from "next/server";
import { githubApi, getDefaultBranch } from "@/lib/github";

const STOPWORDS = new Set([
  "this", "that", "they", "have", "been", "will", "from", "with", "what",
  "when", "where", "how", "than", "over", "their", "there", "would",
  "could", "should", "about", "into", "more", "some", "such", "the", "has",
]);

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function claimKeywords(text: string): string[] {
  return tokens(text).filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function tokensMatching(candidate: string, keywords: string[]): string[] {
  const cand = tokens(candidate);
  return keywords.filter((k) =>
    cand.some((t) => t.includes(k) || (t.length > 3 && k.includes(t)))
  );
}

function isRelevant(candidate: string, keywords: string[], minMatches: number): boolean {
  return tokensMatching(candidate, keywords).length >= minMatches;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = Array.isArray(body.claims) ? body.claims : [];

  if (!repoUrl) {
    return NextResponse.json({ evidence: {}, error: "repoUrl required" });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ evidence: {}, error: "Invalid GitHub URL" });
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  let branch: string;
  try {
    branch = await getDefaultBranch(owner, cleanRepo);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { evidence: {}, error: `Could not access repo ${owner}/${cleanRepo}: ${msg}` },
      { status: 404 }
    );
  }
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  let commits: any;
  let files: any;
  try {
    [commits, files] = await Promise.all([
      githubApi(`${base}/commits?per_page=30`),
      githubApi(`${base}/git/trees/${branch}?recursive=1`),
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { evidence: {}, error: `Failed to fetch repo data: ${msg}` },
      { status: 502 }
    );
  }
  const fileNames: string[] = (files?.tree || [])
    .filter((t: any) => t.type === "blob")
    .map((t: any) => t.path);
  const commitList: any[] = Array.isArray(commits) ? commits : [];

  const evidence: Record<string, any> = {};

  for (const claim of claims) {
    const claimText = claim.text || claim;
    const claimId = claim.id || claimText;
    const keywords = claimKeywords(claimText);

    const matchedFiles = fileNames.filter((f) => isRelevant(f, keywords, 1));
    const matchedCommits = commitList.filter((c) =>
      isRelevant(c.commit?.message || "", keywords, Math.min(2, Math.max(1, Math.ceil(keywords.length / 2))))
    );

    evidence[claimId] = {
      files: matchedFiles.slice(0, 10),
      commits: matchedCommits.slice(0, 5).map((c: any) => ({
        sha: c.sha,
        message: c.commit?.message,
        date: c.commit?.author?.date,
      })),
      matchedTerms: keywords.filter(
        (k) =>
          matchedFiles.some((f) => tokensMatching(f, [k]).length) ||
          matchedCommits.some((c) => tokensMatching(c.commit?.message || "", [k]).length)
      ),
      totalFilesInRepo: fileNames.length,
    };
  }

  return NextResponse.json({ evidence });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("repoUrl") || "";
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitHub URL" });
  }
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const data = await githubApi(
    `https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=5`
  );
  return NextResponse.json({ commits: data });
}
